import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    userRole?: 'admin' | 'approver' | 'purchaser';
    userName?: string;
    oidcState?: string;
    oidcNonce?: string;
    oidcCodeVerifier?: string;
    oidcRedirectUri?: string;
    oidcIdToken?: string;
  }
}
