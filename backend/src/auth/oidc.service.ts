import {Injectable, Logger} from '@nestjs/common';
import * as client from 'openid-client';
import {Role} from './role';

export interface OidcAuthorizationRequest {
  authorizationUrl: URL;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface OidcCallbackChecks {
  state: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface OidcLoginResult {
  subject: string;
  email: string | undefined;
  fullName: string;
  role: Role;
  idToken: string | undefined;
}

const ROLES: readonly Role[] = ['admin', 'approver', 'purchaser'];

/** Short, non-reversible-enough tag used to correlate login and callback log lines. */
export function stateRef(state: string | undefined): string {
  return state ? state.slice(0, 8) : 'no-state';
}

/** Unwraps openid-client's OAuth error shape, which hides detail behind `cause`. */
export function describeOidcError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const parts = [`${error.name}: ${error.message}`];
  const details = error as Error & {
    code?: unknown;
    error?: unknown;
    error_description?: unknown;
  };
  if (typeof details.code === 'string') parts.push(`code=${details.code}`);
  if (typeof details.error === 'string') parts.push(`oauth_error=${details.error}`);
  if (typeof details.error_description === 'string') {
    parts.push(`oauth_error_description=${details.error_description}`);
  }
  if (details.cause instanceof Error) {
    parts.push(`cause=${details.cause.name}: ${details.cause.message}`);
  }
  return parts.join(' ');
}

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);
  private configPromise: Promise<client.Configuration> | undefined;

  async createAuthorizationRequest(
    redirectUri: string
  ): Promise<OidcAuthorizationRequest> {
    const config = await this.getConfig();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();
    const scope = process.env.OIDC_SCOPES || 'openid profile email';

    const authorizationUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce
    });

    this.logger.log(
      `[${stateRef(state)}] Authorization request built: `
      + `endpoint=${authorizationUrl.origin}${authorizationUrl.pathname} `
      + `redirect_uri=${redirectUri} scope="${scope}"`
    );

    return {authorizationUrl, state, nonce, codeVerifier};
  }

  async handleCallback(
    currentUrl: URL,
    checks: OidcCallbackChecks
  ): Promise<OidcLoginResult> {
    const ref = stateRef(checks.state);
    const config = await this.getConfig();

    const startedAt = Date.now();
    this.logger.debug(
      `[${ref}] Exchanging authorization code at `
      + `${config.serverMetadata().token_endpoint ?? 'unknown token endpoint'}`
    );
    const tokens = await client.authorizationCodeGrant(
      config,
      currentUrl,
      {
        expectedState: checks.state,
        expectedNonce: checks.nonce,
        pkceCodeVerifier: checks.codeVerifier
      },
      {redirect_uri: checks.redirectUri}
    );
    this.logger.log(
      `[${ref}] Token exchange succeeded in ${Date.now() - startedAt}ms `
      + `(id_token=${tokens.id_token ? 'yes' : 'no'} `
      + `access_token=${tokens.access_token ? 'yes' : 'no'} `
      + `refresh_token=${tokens.refresh_token ? 'yes' : 'no'})`
    );

    const claims = tokens.claims();
    if (!claims) {
      this.logger.error(`[${ref}] Token response contained no ID token claims`);
      throw new Error('OIDC provider did not return ID token claims');
    }

    const groupsClaim = process.env.OIDC_GROUPS_CLAIM || 'groups';
    const groups = this.extractGroups(claims[groupsClaim]);
    if (!(groupsClaim in claims)) {
      this.logger.warn(
        `[${ref}] ID token has no "${groupsClaim}" claim; `
        + `available claims = ${Object.keys(claims).join(', ')}`
      );
    }

    const role = this.mapGroupsToRole(groups);
    if (!role) {
      this.logger.warn(
        `[${ref}] No role mapped for subject "${claims.sub}"; `
        + `groups=${JSON.stringify(groups)} `
        + `configured=${JSON.stringify(this.roleMap())}`
      );
      throw new Error(
        `User "${claims.sub}" is not a member of any group mapped to a role`
      );
    }

    const email = typeof claims.email === 'string' ? claims.email : undefined;
    const name = typeof claims.name === 'string' ? claims.name : undefined;
    this.logger.log(
      `[${ref}] Claims resolved: sub=${claims.sub} `
      + `email=${email ?? '(none)'} role=${role} `
      + `groups=${JSON.stringify(groups)}`
    );

    return {
      subject: claims.sub,
      email,
      fullName: name ?? email ?? claims.sub,
      role,
      idToken: tokens.id_token
    };
  }

  /** Builds the IdP's RP-initiated logout URL, or undefined if it doesn't support one. */
  async buildEndSessionUrl(
    idToken: string | undefined,
    postLogoutRedirectUri: string
  ): Promise<URL | undefined> {
    const config = await this.getConfig();
    if (!config.serverMetadata().end_session_endpoint) return undefined;
    return client.buildEndSessionUrl(config, {
      post_logout_redirect_uri: postLogoutRedirectUri,
      ...(idToken ? {id_token_hint: idToken} : {})
    });
  }

  private async getConfig(): Promise<client.Configuration> {
    this.configPromise ??= this.discover();
    return this.configPromise;
  }

  private async discover(): Promise<client.Configuration> {
    const issuer = process.env.OIDC_ISSUER;
    const clientId = process.env.OIDC_CLIENT_ID;
    const clientSecret = process.env.OIDC_CLIENT_SECRET;
    if (!issuer || !clientId) {
      throw new Error(
        'OIDC_ISSUER and OIDC_CLIENT_ID must be set to use OIDC authentication'
      );
    }
    this.logger.log(`Discovering OIDC issuer ${issuer} (client_id=${clientId})`);
    try {
      const config = await client.discovery(
        new URL(issuer),
        clientId,
        clientSecret ? {client_secret: clientSecret} : undefined
      );
      const metadata = config.serverMetadata();
      this.logger.log(
        `OIDC discovery succeeded: issuer=${metadata.issuer} `
        + `authorization_endpoint=${metadata.authorization_endpoint ?? '(none)'} `
        + `token_endpoint=${metadata.token_endpoint ?? '(none)'} `
        + `end_session_endpoint=${metadata.end_session_endpoint ?? '(none)'}`
      );
      return config;
    } catch (error) {
      // Reset so a transient discovery failure doesn't poison every later login.
      this.configPromise = undefined;
      this.logger.error(
        `OIDC discovery failed for issuer ${issuer}: ${describeOidcError(error)}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  private extractGroups(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw.filter((value): value is string => typeof value === 'string');
    }
    if (typeof raw === 'string') return [raw];
    return [];
  }

  private mapGroupsToRole(groups: string[]): Role | undefined {
    const mapping = this.roleMap();
    const memberOf = new Set(groups);
    for (const role of ROLES) {
      if (mapping[role].some(group => memberOf.has(group))) return role;
    }
    return undefined;
  }

  private roleMap(): Record<Role, string[]> {
    const empty: Record<Role, string[]> = {admin: [], approver: [], purchaser: []};
    const raw = process.env.OIDC_ROLE_MAP;
    if (!raw) return empty;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const role of ROLES) {
          const groups = (parsed as Record<string, unknown>)[role];
          if (Array.isArray(groups)) {
            empty[role] = groups.filter(
              (value): value is string => typeof value === 'string'
            );
          }
        }
      }
      return empty;
    } catch (error) {
      this.logger.error('Failed to parse OIDC_ROLE_MAP', error as Error);
      return empty;
    }
  }
}
