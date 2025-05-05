declare module 'passport-azure-ad' {
  import { Request } from 'express';
  
  export interface IBearerStrategyOptions {
    identityMetadata: string;
    clientID: string;
    validateIssuer?: boolean;
    issuer?: string;
    passReqToCallback?: boolean;
    loggingLevel?: string;
    loggingNoPII?: boolean;
  }

  export interface IOIDCStrategyOptions {
    identityMetadata: string;
    clientID: string;
    clientSecret?: string;
    responseType?: string;
    responseMode?: string;
    redirectUrl?: string;
    allowHttpForRedirectUrl?: boolean;
    validateIssuer?: boolean;
    issuer?: string;
    passReqToCallback?: boolean;
    scope?: string[];
    loggingLevel?: string;
    nonceLifetime?: number;
    nonceMaxAmount?: number;
    useCookieInsteadOfSession?: boolean;
    cookieEncryptionKeys?: Array<{key: string, iv: string}>;
    clockSkew?: number;
  }

  export class BearerStrategy {
    constructor(
      options: IBearerStrategyOptions,
      verify: (req: Request, token: any, done: (error: any, user?: any, info?: any) => void) => void
    );
  }

  export class OIDCStrategy {
    constructor(
      options: IOIDCStrategyOptions,
      verify: (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: any, info?: any) => void) => void
    );
  }
}