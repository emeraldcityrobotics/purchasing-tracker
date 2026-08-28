# Purchasing Tracker Agent Instructions

## Project Context

This repository is a purchasing request and order fulfillment tracker.

The current backend is an Express server with a SQLite database:

- Backend entry point: `server.js`
- Database: `purchasing.db`
- Legacy frontend: `public/`
- Angular frontend: `frontend/`

During the Angular migration, preserve the existing Express API and SQLite database unless the user explicitly requests backend changes.

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
4. Use `functions.get_errors` for touched Angular files when available.
5. Do not broaden the change to unrelated backend or legacy frontend issues.

## Commands

Start the backend from the repository root:

```bash
npm start
```

Start the Angular development server in a second terminal:

```bash
cd frontend
npm start
```

The Angular development proxy forwards `/api` requests to `http://localhost:3000`.
