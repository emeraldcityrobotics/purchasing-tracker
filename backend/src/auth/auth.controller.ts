import {Controller, Get, Logger, Req, Res} from '@nestjs/common';
import type {Request, Response} from 'express';
import {AuthService} from './auth.service';
import {OidcService} from './oidc.service';
@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly oidc: OidcService
  ) {}

  @Get('oidc/login') async oidcLogin(
    @Req() request: Request,
    @Res() response: Response
  ) {
    const redirectUri = this.callbackUrl(request);
    const {authorizationUrl, state, nonce, codeVerifier}
      = await this.oidc.createAuthorizationRequest(redirectUri);
    request.session.oidcState = state;
    request.session.oidcNonce = nonce;
    request.session.oidcCodeVerifier = codeVerifier;
    request.session.oidcRedirectUri = redirectUri;
    response.redirect(authorizationUrl.href);
  }

  @Get('oidc/callback') async oidcCallback(
    @Req() request: Request,
    @Res() response: Response
  ) {
    const {oidcState, oidcNonce, oidcCodeVerifier, oidcRedirectUri}
      = request.session;
    delete request.session.oidcState;
    delete request.session.oidcNonce;
    delete request.session.oidcCodeVerifier;
    delete request.session.oidcRedirectUri;

    const frontendOrigin
      = process.env.FRONTEND_ORIGIN || 'http://localhost:4200';
    if (!oidcState || !oidcNonce || !oidcCodeVerifier || !oidcRedirectUri) {
      response.redirect(`${frontendOrigin}/login?error=oidc_session_expired`);
      return;
    }

    try {
      const currentUrl = new URL(
        `${request.protocol}://${request.get('host')}${request.originalUrl}`
      );
      const result = await this.oidc.handleCallback(currentUrl, {
        state: oidcState,
        nonce: oidcNonce,
        codeVerifier: oidcCodeVerifier,
        redirectUri: oidcRedirectUri
      });
      const username = result.email ?? result.subject;
      const user = await this.auth.upsertOidcUser(
        result.subject,
        username,
        result.fullName,
        result.role
      );
      this.auth.signIn(request, user);
      request.session.oidcIdToken = result.idToken;
      response.redirect(`${frontendOrigin}/tracking`);
    } catch (error) {
      this.logger.error('OIDC callback failed', error as Error);
      response.redirect(`${frontendOrigin}/login?error=oidc_failed`);
    }
  }

  @Get('logout') async logout(
    @Req() request: Request,
    @Res() response: Response
  ) {
    const frontendOrigin
      = process.env.FRONTEND_ORIGIN || 'http://localhost:4200';
    const idToken = request.session.oidcIdToken;
    const endSessionUrl = await this.oidc.buildEndSessionUrl(
      idToken,
      `${frontendOrigin}/login`
    );
    await this.auth.signOut(request);
    response.redirect(endSessionUrl?.href ?? `${frontendOrigin}/login`);
  }

  @Get('check') check(@Req() request: Request) {
    return request.session.userId
      ? {
        authenticated: true,
        userId: request.session.userId,
        role: request.session.userRole,
        fullName: request.session.userName
      }
      : {authenticated: false};
  }

  private callbackUrl(request: Request): string {
    return (
      process.env.OIDC_REDIRECT_URI
      || `${request.protocol}://${request.get('host')}/api/auth/oidc/callback`
    );
  }
}
