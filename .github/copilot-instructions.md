# Purchasing Tracker Agent Instructions

## Project Context

This repository is a purchasing request and order fulfillment tracker.

The current backend is a NestJS server with a SQLite database:

- Nest backend: `backend/`
- Nest entry point: `backend/src/main.ts`
- Database: `purchasing.db`
- Angular frontend: `frontend/`

The Nest backend is the only backend implementation. Preserve the existing API paths and SQLite database during refactoring unless the user explicitly requests an API or schema change.

## NestJS Architecture

Use NestJS best practices throughout `backend/`:

- Organize code by feature modules such as `auth`, `catalog`, `purchase-requests`, `admin`, and `integrations`.
- Keep database access and schema initialization in the injectable `DatabaseService` under `backend/src/database/`.
- Put shared business logic used by multiple controllers in injectable services.
- Keep controllers focused on HTTP concerns, authorization metadata, and orchestration.
- Use Nest guards and `@Roles(...)` metadata for authentication and role authorization.
- Use DTOs with `class-validator` and the global `ValidationPipe` for new or changed request contracts.
- Keep session handling in the auth boundary; use the existing session cookie contract for Angular.
- Keep Slack, Google Sheets, secrets, password hashing, and database operations server-side.
- Prefer transactions or database-level safeguards when changing approval counts, receiving quantities, or other workflow state.
- Use environment variables for session secrets, database paths, ports, origins, and integration configuration.

The current Nest database service intentionally reads the existing SQLite file to support incremental migration. Use a proper migration strategy before making destructive schema changes.

## Angular Architecture

Use modern standalone Angular patterns throughout `frontend/`:

- Keep route-served page components under `frontend/src/app/pages/`.
- Keep singleton and business services under `frontend/src/app/core/`.
- Keep reusable presentation components under `frontend/src/app/shared/`.
- Define routes in `frontend/src/app/app.routes.ts` with lazy-loaded page components.
- Use route guards for authentication and role authorization.
- Use `provideHttpClient` and functional HTTP interceptors.
- Prefer signals for local and shared reactive state where appropriate.
- Keep components focused on presentation and user interaction.
- Put API access, calculations, workflow transitions, validation rules, and notification behavior in injectable services.
- Do not duplicate API calls, authentication logic, calculations, or toast behavior across page components.

## Templates and Styling

- Every Angular component must use an external HTML template through `templateUrl`.
- Do not add inline `template` strings.
- Keep component-specific styles in external `.scss` files when practical; use global styles only for shared design tokens and primitives.
- Preserve the existing visual language unless the user asks for a redesign.
- Keep the UI responsive and accessible, including labels, keyboard operation, useful focus states, and appropriate disabled/loading states.

## Existing Domain Rules

Preserve these behaviors when refactoring the frontend:

- All backend routes require authentication; there are no public/anonymous `/api/public/*` endpoints or access-code gates. Every controller uses `AuthGuard` (directly or via a class-level `@UseGuards`), with `RoleGuard` + `@Roles(...)` added for role-restricted routes.
- Staff authentication is OIDC-only (Authorization Code + PKCE via `openid-client`): `GET /api/auth/oidc/login`, `GET /api/auth/oidc/callback`, `GET /api/auth/logout` (RP-initiated logout via the IdP's `end_session_endpoint` when available), and `GET /api/auth/check`. There is no password-based login.
- OIDC group claims map to app roles via the `OIDC_ROLE_MAP` env var, shaped as `{"admin": [...groups], "approver": [...groups], "purchaser": [...groups]}` (role first, then group paths/names). Role priority on conflict is admin > approver > purchaser. Users not in any mapped group are denied login.
- On first OIDC login, a local `users` row is created/updated (keyed by `oidc_subject`, falling back to matching an existing `username`) so existing `requester_id`/`approved_by`/etc. foreign keys keep working.
- Roles are `admin`, `approver`, and `purchaser`.
- Request status flow is `pending`, `approved`, `rejected`, `ordered`, `partially_received`, and `completed`.
- Request totals include item subtotal, tax, shipping, and tariff.
- High-value requests may require multiple approvals according to backend settings.
- Receiving is tracked per item and updates the request status.
- Slack and Google Sheets integrations remain server-side concerns exposed through the existing API.
- Preserve the API response shapes consumed by `frontend/src/app/core/api.service.ts` unless coordinating a frontend change.
- All Angular routes require `authGuard` except `/login`; role-restricted pages also use `roleGuard(...)`. `AuthService.check()` runs once on app bootstrap (in `App`) and again inside `authGuard` on every guarded navigation, since a full-page OIDC redirect back into the app does not otherwise re-sync the auth signal.

Do not move secrets, webhook calls, password handling, or database logic into Angular.

## Linting

- ESLint (flat config) is set up at three levels: a shared root config (`eslint.config.mjs`) plus `backend/eslint.config.mjs` and `frontend/eslint.config.mjs`, each importing and extending the root config with their own framework-specific rules (NestJS/TypeScript + Prettier for backend; Angular + TypeScript for frontend).
- The root config provides `@eslint/js` recommended rules, `typescript-eslint` recommended rules (scoped to `**/*.{ts,mts,cts,tsx}`), and `@stylistic/eslint-plugin` recommended rules (scoped to JS/TS files only, not `.html`).
- Semicolons are required (`@stylistic/semi: ["error", "always"]`), overriding `@stylistic`'s own default of no semicolons — preserve this override if touching the root config.
- `backend/` and `frontend/` intentionally do not install their own copy of `typescript-eslint`/`@stylistic/eslint-plugin` where avoidable; they resolve the root's copy via Node's module resolution so the same plugin instance is shared (registering the same plugin twice with different instances causes an ESLint "Cannot redefine plugin" error). Keep versions of shared eslint-related packages aligned across `package.json` files.
- Run lint via `npm run lint` (root, runs root + backend + frontend), or `npm --prefix backend run lint` / `npm --prefix frontend run lint` individually.

## Logging

- All backend requests are logged via `LoggingMiddleware` (`backend/src/common/logging.middleware.ts`), applied globally in `AppModule.configure()` with `forRoutes('*')`. It logs `METHOD URL STATUS DURATIONms` using Nest's built-in `Logger`.

## Implementation Workflow

Before changing code:

1. Inspect the owning route, component, service, or API contract.
2. Identify one local behavior hypothesis and the cheapest check that can disconfirm it.
3. Make the smallest focused change consistent with the existing architecture.

After editing:

1. Run the narrowest relevant validation first.
2. For Angular changes, run `npm --prefix frontend run build`.
3. Run `npx --prefix frontend tsc --noEmit -p frontend/tsconfig.app.json` when checking module resolution or typing.
4. For Nest changes, run `npm --prefix backend run build`.
5. Use `npm --prefix backend run test` or the narrowest relevant Jest test when behavior changes.
6. Use `functions.get_errors` for touched files when available.
7. Smoke-test protected routes (expect `403` without a session), the OIDC login/callback/logout redirect chain, session persistence, and the primary workflow on an available port.
8. Do not broaden the change to unrelated backend or frontend issues.

## Commands

Start the backend from the repository root:

```bash
npm start
```

Equivalent Nest commands:

```bash
npm --prefix backend run build
npm --prefix backend run start:dev
```

Start the Angular development server in a second terminal:

```bash
cd frontend
npm start
```

The Angular development proxy forwards `/api` requests to `http://localhost:3000`. If port `3000` is occupied, run Nest on another port for smoke testing, for example `PORT=3001 npm --prefix backend run start`, and point the development proxy at that port temporarily.

OIDC login requires real IdP configuration (`OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`, `OIDC_ROLE_MAP`, etc.) in `backend/.env` (gitignored; see `backend/.env.example` for the full list and shape). `nest start` (without `--watch`) does not reload `.env` changes or code changes — fully restart the process after editing `.env` or when not running in watch mode.

## Verified Smoke-Test Notes

- Nest starts and registers the expected API modules and routes successfully.
- The existing SQLite seed data is readable by Nest.
- Every route returns `403` when called without a valid session cookie (no public endpoints remain).
- `GET /api/auth/oidc/login` redirects (`302`) to the IdP's authorization endpoint with PKCE parameters.
- A successful OIDC callback redirects (`302`) to `${FRONTEND_ORIGIN}/tracking`; a failed one redirects to `${FRONTEND_ORIGIN}/login?error=...`.
- `GET /api/auth/logout` redirects (`302`) to the IdP's end-session endpoint (or straight to `/login` if the IdP doesn't support one) and destroys the local session either way.
- Authenticated request listing returns `200`.
- Nest's default failed-guard response is `403`; normalize to legacy `401` only when API compatibility requires it.
