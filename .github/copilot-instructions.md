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

- Public request submission uses the public `/api/public/*` endpoints and the existing access-code flow.
- Staff authentication uses `/api/login`, `/api/logout`, and `/api/auth/check` with the existing session cookie.
- Roles are `admin`, `approver`, and `purchaser`.
- Request status flow is `pending`, `approved`, `rejected`, `ordered`, `partially_received`, and `completed`.
- Request totals include item subtotal, tax, shipping, and tariff.
- High-value requests may require multiple approvals according to backend settings.
- Receiving is tracked per item and updates the request status.
- Slack and Google Sheets integrations remain server-side concerns exposed through the existing API.
- Preserve the API response shapes consumed by `frontend/src/app/core/api.service.ts` unless coordinating a frontend change.

Do not move secrets, webhook calls, password handling, or database logic into Angular.

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
7. Smoke-test public routes, login/session persistence, protected routes, and the primary workflow on an available port.
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

## Verified Smoke-Test Notes

- Nest starts and registers the expected API modules and routes successfully.
- The existing SQLite seed data is readable by Nest.
- Public vendor/status endpoints return `200`.
- Admin login with the seeded credentials creates a working session cookie.
- Authenticated request listing returns `200`.
- Nest's default failed-guard response is `403`; normalize to legacy `401` only when API compatibility requires it.
- Nest's default successful `POST /api/login` response is `201`; normalize to `200` only when API compatibility requires it.
