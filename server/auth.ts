import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { OIDCStrategy } from "passport-azure-ad";
import { Express, Request } from "express";
// Extend passport types
declare module 'passport' {
  interface PassportStatic {
    use(name: string, strategy: any): PassportStatic;
  }
}
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

// Helper function to get authentication settings
async function getAuthSettings() {
  const defaults = {
    localAuth: true,
    microsoftAuth: true,
    userRegistration: false,
    microsoftApprovalRequired: true
  };
  
  try {
    // Try to get local auth setting
    const localAuthSetting = await storage.getAppSettingByKey("local_auth");
    if (localAuthSetting) {
      defaults.localAuth = localAuthSetting.value === "true";
    }
  } catch (error) {
    console.error("Error fetching local_auth setting:", error);
  }
  
  try {
    // Try to get Microsoft auth setting
    const microsoftAuthSetting = await storage.getAppSettingByKey("microsoft_auth");
    if (microsoftAuthSetting) {
      defaults.microsoftAuth = microsoftAuthSetting.value === "true";
    }
  } catch (error) {
    console.error("Error fetching microsoft_auth setting:", error);
  }
  
  try {
    // Try to get user registration setting
    const userRegSetting = await storage.getAppSettingByKey("allow_registration");
    if (userRegSetting) {
      defaults.userRegistration = userRegSetting.value === "true";
    }
  } catch (error) {
    console.error("Error fetching allow_registration setting:", error);
  }
  
  try {
    // Try to get Microsoft approval requirement setting
    const microsoftApprovalSetting = await storage.getAppSettingByKey("microsoft_approval_required");
    if (microsoftApprovalSetting) {
      defaults.microsoftApprovalRequired = microsoftApprovalSetting.value === "true";
    }
  } catch (error) {
    console.error("Error fetching microsoft_approval_required setting:", error);
  }
  
  return defaults;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "task-manager-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use('local',
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        
        // Check if user is blocked
        if (user.isBlocked) {
          console.log(`Login denied for blocked user: ${username}`);
          return done(null, false, { message: 'Your account has been blocked. Please contact an administrator.' });
        }
        
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  // Microsoft Entra ID (Azure AD) OAuth Strategy
  // Check if required environment variables are set
  const hasEntraConfig = process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET;
  
  if (hasEntraConfig) {
    console.log("Microsoft Entra ID configuration detected. Setting up authentication.");
  } else {
    console.warn("Microsoft Entra ID configuration not found. OAuth login will not be available.");
    console.warn("Set ENTRA_TENANT_ID, ENTRA_CLIENT_ID, and ENTRA_CLIENT_SECRET environment variables to enable it.");
  }
  
  const entraOptions = {
    identityMetadata: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID || 'common'}/v2.0/.well-known/openid-configuration`,
    clientID: process.env.ENTRA_CLIENT_ID || '',
    responseType: 'code',
    responseMode: 'query',
    redirectUrl: process.env.NODE_ENV === 'production' 
      ? 'https://mist.promellon.com/api/auth/entra/callback' 
      : 'http://localhost:5000/api/auth/entra/callback',
    clientSecret: process.env.ENTRA_CLIENT_SECRET || '',
    validateIssuer: true,
    issuer: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID || 'common'}/v2.0`,
    passReqToCallback: false,
    scope: ['profile', 'email', 'openid']
  };

  passport.use('azuread-openidconnect',
    new OIDCStrategy({
      identityMetadata: entraOptions.identityMetadata,
      clientID: process.env.ENTRA_CLIENT_ID as string,
      clientSecret: process.env.ENTRA_CLIENT_SECRET as string,
      responseType: entraOptions.responseType,
      responseMode: entraOptions.responseMode,
      redirectUrl: entraOptions.redirectUrl,
      allowHttpForRedirectUrl: process.env.NODE_ENV !== 'production',
      validateIssuer: entraOptions.validateIssuer,
      issuer: entraOptions.issuer,
      passReqToCallback: false,
      scope: entraOptions.scope,
    }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        // Find user by email or entraId
        const email = profile._json.preferred_username || profile._json.email;
        let user = await storage.getUserByUsername(email);
        
        // User doesn't exist, create a new one
        if (!user) {
          // Check if approval is required for new Microsoft users
          const authSettings = await getAuthSettings();
          const displayName = profile._json.name || email.split('@')[0];
          
          user = await storage.createUser({
            username: email,
            name: displayName,
            password: await hashPassword(randomBytes(16).toString('hex')), // Generate random password for OAuth users
            avatar: null,
            isApproved: !authSettings.microsoftApprovalRequired, // Only require approval if setting is enabled
            hasCompletedOnboarding: false // New users need to complete onboarding
          });
          
          // Notify admins about new user pending approval only if approval is required
          if (authSettings.microsoftApprovalRequired) {
            try {
              const admins = await storage.getAdminUsers();
              for (const admin of admins) {
                await storage.createNotification({
                  userId: admin.id,
                  title: 'New User Pending Approval',
                  message: `${displayName} (${email}) has registered via Microsoft authentication and is awaiting approval.`,
                  type: 'user_approval'
                });
              }
            } catch (error) {
              console.error('Error creating admin notifications:', error);
            }
          }
        }
        
        // Check if user is blocked
        if (user.isBlocked) {
          console.log(`Microsoft login denied for blocked user: ${email}`);
          const error = new Error('Your account has been blocked. Please contact an administrator.');
          (error as any).code = 'USER_BLOCKED';
          return done(error);
        }
        
        // Check if approval is required for Microsoft authentication users
        const finalAuthSettings = await getAuthSettings();
        if (finalAuthSettings.microsoftApprovalRequired && !user.isApproved) {
          // Return a special error that indicates the user needs approval
          const error = new Error('User account pending approval');
          (error as any).code = 'APPROVAL_PENDING';
          (error as any).user = user;
          return done(error);
        }
        
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Check if registration is allowed
      const authSettings = await getAuthSettings();
      if (!authSettings.userRegistration) {
        return res.status(403).json({ error: "User registration is currently disabled" });
      }
      
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", async (req, res, next) => {
    try {
      // Check if local auth is allowed
      const authSettings = await getAuthSettings();
      if (!authSettings.localAuth) {
        return res.status(403).json({ error: "Local authentication is currently disabled" });
      }
      
      passport.authenticate('local', (err: any, user: Express.User, info: any) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ error: "Invalid credentials" });
        
        req.login(user, (err: any) => {
          if (err) return next(err);
          return res.status(200).json(user);
        });
      })(req, res, next);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err: any) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
  
  // Microsoft Entra ID routes
  app.get('/api/auth/entra', async (req, res, next) => {
    try {
      // Check if Microsoft auth is allowed
      const authSettings = await getAuthSettings();
      if (!authSettings.microsoftAuth) {
        return res.redirect('/auth?error=microsoft_auth_disabled');
      }
      
      passport.authenticate('azuread-openidconnect', {
        session: true,
        failureRedirect: '/auth',
        failureFlash: false
      })(req, res, next);
    } catch (err) {
      console.error('Error checking Microsoft auth settings:', err);
      return res.redirect('/auth?error=server_error');
    }
  });

  app.get('/api/auth/entra/callback', async (req, res, next) => {
    try {
      // Verify Microsoft auth is still enabled
      const authSettings = await getAuthSettings();
      if (!authSettings.microsoftAuth) {
        return res.redirect('/auth?error=microsoft_auth_disabled');
      }
      
      passport.authenticate('azuread-openidconnect', {
        session: true,
        failureRedirect: '/auth',
        failureFlash: false
      }, (err: any, user: any) => {
        if (err) {
          // Check if this is an approval pending error
          if (err.code === 'APPROVAL_PENDING') {
            return res.redirect('/auth?error=approval_pending&user=' + encodeURIComponent(err.user.name));
          }
          console.error('Microsoft Entra authentication error:', err);
          return res.redirect('/auth?error=microsoft_auth_error');
        }
        
        if (!user) {
          return res.redirect('/auth?error=microsoft_auth_failed');
        }
        
        req.login(user, (loginErr) => {
          if (loginErr) {
            console.error('Login error after Microsoft authentication:', loginErr);
            return res.redirect('/auth?error=microsoft_login_error');
          }
          return res.redirect('/');
        });
      })(req, res, next);
    } catch (err) {
      console.error('Error in Microsoft auth callback:', err);
      return res.redirect('/auth?error=server_error');
    }
  });
}