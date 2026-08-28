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

    const authorizationUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: process.env.OIDC_SCOPES || 'openid profile email',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce
    });

    return {authorizationUrl, state, nonce, codeVerifier};
  }

  async handleCallback(
    currentUrl: URL,
    checks: OidcCallbackChecks
  ): Promise<OidcLoginResult> {
    const config = await this.getConfig();
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

    const claims = tokens.claims();
    if (!claims) {
      throw new Error('OIDC provider did not return ID token claims');
    }

    const groupsClaim = process.env.OIDC_GROUPS_CLAIM || 'groups';
    const groups = this.extractGroups(claims[groupsClaim]);
    const role = this.mapGroupsToRole(groups);
    if (!role) {
      this.logger.warn(
        `No role mapped for subject "${claims.sub}"; groups = ${JSON.stringify(groups)}`
      );
      throw new Error(
        `User "${claims.sub}" is not a member of any group mapped to a role`
      );
    }

    const email = typeof claims.email === 'string' ? claims.email : undefined;
    const name = typeof claims.name === 'string' ? claims.name : undefined;

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
    return client.discovery(
      new URL(issuer),
      clientId,
      clientSecret ? {client_secret: clientSecret} : undefined
    );
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
