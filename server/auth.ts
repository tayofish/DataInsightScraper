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

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
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
        } else {
          return done(null, user);
        }
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
      ? 'https://yourdomain.com/api/auth/entra/callback' 
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
          const displayName = profile._json.name || email.split('@')[0];
          user = await storage.createUser({
            username: email,
            name: displayName,
            password: await hashPassword(randomBytes(16).toString('hex')), // Generate random password for OAuth users
            avatar: null
          });
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

  app.post("/api/login", (req, res, next) => {
    passport.authenticate('local', (err: any, user: Express.User, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: "Invalid credentials" });
      
      req.login(user, (err: any) => {
        if (err) return next(err);
        return res.status(200).json(user);
      });
    })(req, res, next);
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
  app.get('/api/auth/entra', passport.authenticate('azuread-openidconnect', {
    session: true,
    failureRedirect: '/auth',
    failureFlash: false
  }));

  app.get('/api/auth/entra/callback', (req, res, next) => {
    passport.authenticate('azuread-openidconnect', {
      session: true,
      failureRedirect: '/auth',
      failureFlash: false
    }, (err: any, user: any) => {
      if (err) {
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
  });
}