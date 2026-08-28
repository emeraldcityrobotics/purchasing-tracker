import {Controller, Get, Logger, Req, Res} from '@nestjs/common';
import type {Request, Response} from 'express';
import {AuthService} from './auth.service';
import {OidcService, describeOidcError, stateRef} from './oidc.service';
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
    try {
      const {authorizationUrl, state, nonce, codeVerifier}
        = await this.oidc.createAuthorizationRequest(redirectUri);
      request.session.oidcState = state;
      request.session.oidcNonce = nonce;
      request.session.oidcCodeVerifier = codeVerifier;
      request.session.oidcRedirectUri = redirectUri;
      this.logger.log(
        `[${stateRef(state)}] Login start: session=${request.sessionID} `
        + `ip=${request.ip} redirecting to IdP`
      );
      response.redirect(authorizationUrl.href);
    } catch (error) {
      this.logger.error(
        `Login start failed (redirect_uri=${redirectUri}): `
        + describeOidcError(error),
        error instanceof Error ? error.stack : undefined
      );
      response.redirect(
        `${this.frontendOrigin()}/login?error=oidc_unavailable`
      );
    }
  }

  @Get('oidc/callback') async oidcCallback(
    @Req() request: Request,
    @Res() response: Response
  ) {
    const startedAt = Date.now();
    const {oidcState, oidcNonce, oidcCodeVerifier, oidcRedirectUri}
      = request.session;
    const ref = stateRef(oidcState);
    delete request.session.oidcState;
    delete request.session.oidcNonce;
    delete request.session.oidcCodeVerifier;
    delete request.session.oidcRedirectUri;

    const frontendOrigin = this.frontendOrigin();
    const query = request.query as Record<string, unknown>;
    this.logger.log(
      `[${ref}] Callback received: session=${request.sessionID} `
      + `params=[${Object.keys(query).join(', ')}]`
    );

    if (typeof query.error === 'string') {
      this.logger.error(
        `[${ref}] IdP returned an error: ${query.error} `
        + `description=${String(query.error_description ?? '(none)')}`
      );
      response.redirect(`${frontendOrigin}/login?error=oidc_failed`);
      return;
    }

    if (!oidcState || !oidcNonce || !oidcCodeVerifier || !oidcRedirectUri) {
      const missing = [
        !oidcState && 'state',
        !oidcNonce && 'nonce',
        !oidcCodeVerifier && 'codeVerifier',
        !oidcRedirectUri && 'redirectUri'
      ].filter(Boolean).join(', ');
      this.logger.warn(
        `[${ref}] Callback session state incomplete (missing: ${missing}); `
        + `session=${request.sessionID}. Usually a lost/rotated session cookie, `
        + 'a different backend instance, or a stale bookmarked callback URL.'
      );
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
      this.logger.log(
        `[${ref}] Login succeeded in ${Date.now() - startedAt}ms: `
        + `userId=${user.id} username=${username} role=${result.role}`
      );
      response.redirect(`${frontendOrigin}/tracking`);
    } catch (error) {
      this.logger.error(
        `[${ref}] Callback failed after ${Date.now() - startedAt}ms `
        + `(redirect_uri=${oidcRedirectUri}): ${describeOidcError(error)}`,
        error instanceof Error ? error.stack : undefined
      );
      response.redirect(`${frontendOrigin}/login?error=oidc_failed`);
    }
  }

  @Get('logout') async logout(
    @Req() request: Request,
    @Res() response: Response
  ) {
    const frontendOrigin = this.frontendOrigin();
    const userId = request.session.userId;
    const idToken = request.session.oidcIdToken;
    let endSessionUrl: URL | undefined;
    try {
      endSessionUrl = await this.oidc.buildEndSessionUrl(
        idToken,
        `${frontendOrigin}/login`
      );
    } catch (error) {
      this.logger.error(
        `Failed to build end-session URL: ${describeOidcError(error)}`,
        error instanceof Error ? error.stack : undefined
      );
    }
    await this.auth.signOut(request);
    this.logger.log(
      `Logout: userId=${userId ?? '(anonymous)'} `
      + `id_token_hint=${idToken ? 'yes' : 'no'} `
      + `rp_initiated=${endSessionUrl ? 'yes' : 'no'}`
    );
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

  private frontendOrigin(): string {
    return process.env.FRONTEND_ORIGIN || 'http://localhost:4200';
  }
}
