# Purchasing Tracker

A comprehensive web-based purchasing tracker system with request submission, approval workflow, and order tracking capabilities.

## Features

### 🛍️ Purchase Request Submission
- Create purchase requests with vendor selection
- Add multiple products with quantity, price, and description
- Automatic tax calculation
- Dynamic form with add/remove item functionality
- Notes field for special instructions

### ✅ Purchase Request Approval
- Authenticated approval interface for admin and approver roles
- View detailed purchase request information
- Approve or reject purchase requests
- Track approval history and approver information
- Real-time status updates

### 📦 Purchase Tracking & Receiving
- Track purchase order progression through multiple stages:
  - **Pending**: Awaiting approval
  - **Approved**: Ready to be ordered
  - **Rejected**: Request rejected
  - **Ordered**: Order placed with vendor
  - **Partially Received**: Some items received
  - **Completed**: All items received
- Visual progress bars showing receiving status
- Item-by-item receiving interface
- Mark orders as received with quantity tracking
- Filter orders by status

### 🔐 OIDC Authentication
- Sign-in via your organization's OIDC identity provider (Authorization Code + PKCE)
- No local passwords — roles are assigned from IdP group membership
- Three user roles with different permissions:
  - **Admin**: Full system access
  - **Approver**: Can approve/reject purchase requests
  - **Purchaser**: Can submit requests and track orders
- Session-based authentication after sign-in
- Role-based access control; every backend route requires authentication

## Technology Stack

- **Backend**: NestJS (Node.js/TypeScript) with Express
- **Database**: SQLite with better-sqlite3
- **Authentication**: OpenID Connect via `openid-client` (Authorization Code + PKCE), session-based after login
- **Frontend**: Angular (standalone components, signals)
- **Styling**: Custom CSS/SCSS design system

## Running the App

### Prerequisites

- Node.js 22+
- An OIDC identity provider (Keycloak, Okta, Auth0, Entra ID, etc.) with a confidential client configured for Authorization Code + PKCE

### Development (separate frontend/backend processes)

1. Copy `backend/.env.example` to `backend/.env` and fill in `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI` (e.g. `http://localhost:3000/api/auth/oidc/callback`), and `OIDC_ROLE_MAP`.
2. Install dependencies:
   ```bash
   npm install --prefix backend
   npm install --prefix frontend
   ```
3. Start the backend (from the repo root):
   ```bash
   npm run dev
   ```
   This runs Nest in watch mode on `http://localhost:3000`. `.env` changes require restarting this process.
4. In a second terminal, start the Angular dev server:
   ```bash
   cd frontend
   npm start
   ```
   Open `http://localhost:4200`. The Angular dev server proxies `/api` requests to the backend (`frontend/proxy.conf.json`).

### Production (single process via Docker)

In production, the backend serves the built Angular app itself — one process, no dev proxy. The included multi-stage `Dockerfile` builds both apps into a single image.

```bash
docker build -t purchasing-tracker .
docker run -p 3000:3000 \
  -e SESSION_SECRET=... \
  -e FRONTEND_ORIGIN=https://your-domain \
  -e OIDC_ISSUER=... \
  -e OIDC_CLIENT_ID=... \
  -e OIDC_CLIENT_SECRET=... \
  -e OIDC_REDIRECT_URI=https://your-domain/api/auth/oidc/callback \
  -e OIDC_ROLE_MAP='{"admin":["your-admin-group"],"approver":["your-approver-group"],"purchaser":["your-purchaser-group"]}' \
  -v purchasing-data:/app/data \
  purchasing-tracker
```

The SQLite database lives at `/app/data/purchasing.db` in the container; mount a volume there (as above) to persist it across restarts. See `backend/.env.example` for the full list of environment variables.

Without Docker, the same single-process setup can be run directly:

```bash
npm run build   # builds the frontend, then the backend
npm start        # runs backend/dist/main.js, which also serves the built Angular app
```

## Roles & Access

There are no local passwords — every user signs in through your OIDC provider. Roles are assigned from IdP group membership via the `OIDC_ROLE_MAP` environment variable (see `backend/.env.example`); a user not in any mapped group is denied login.

| Role      | Capabilities                                    |
|-----------|--------------------------------------------------|
| Admin     | Full access to all features                       |
| Approver  | Can approve/reject purchase requests              |
| Purchaser | Can submit requests and track orders              |

## Usage Guide

### Creating a Purchase Request

1. Sign in via your organization's SSO
2. Go to "New Request" tab (default view)
3. Select a vendor from the dropdown
4. Add items:
   - Click "Add Item" to add product rows
   - Enter product name, description, quantity, and unit price
   - Line totals calculate automatically
5. Adjust tax rate if needed (defaults to 7.5%)
6. Add optional notes
7. Review the calculated subtotal, tax, and total
8. Click "Submit Purchase Request"

### Approving Purchase Requests

1. Sign in with an admin or approver account
2. Go to "Approvals" tab
3. View the list of pending requests
4. Click "View" to see detailed information
5. Click "Approve" or "Reject" to process the request

### Tracking and Receiving Orders

1. Sign in with any account
2. Go to "Track Orders" tab
3. Use the status filter to find specific orders
4. Click "Track & Receive" to view order details
5. For approved orders:
   - Click "Mark as Ordered" once you've placed the order with the vendor
6. For ordered/partially received items:
   - Enter the quantity received for each item
   - Click "Receive" to update the receiving status
7. Orders automatically update to "Completed" when all items are received

## Database Schema

### Tables

- **users**: User accounts with authentication and roles
- **vendors**: Vendor information
- **purchase_requests**: Main purchase request records
- **purchase_request_items**: Individual items within each request

### Status Workflow

```
Pending → Approved → Ordered → Partially Received → Completed
         ↓
      Rejected
```

## Sample Vendors

The system includes three pre-configured vendors:
- Office Supplies Inc
- Tech Solutions Ltd
- Industrial Equipment Co

## Project Structure

```
purchasing-tracker/
├── Dockerfile              # Multi-stage build: Angular + NestJS in one image
├── package.json            # Root scripts (build/start/lint) delegating to backend/frontend
├── eslint.config.mjs       # Shared root ESLint config
├── backend/
│   ├── src/                # NestJS application (auth, catalog, purchase-requests, admin, integrations)
│   ├── .env.example        # Required/optional environment variables
│   └── purchasing.db       # SQLite database (created on first run)
└── frontend/
    ├── src/app/pages/       # Route-served Angular page components
    ├── src/app/core/        # Injectable API, auth, workflow, and notification services
    ├── src/app/shared/      # Shared shell and toast components
    └── proxy.conf.json      # Local Angular-to-Nest dev proxy
```

## Security Features

- OIDC (Authorization Code + PKCE) authentication — no local passwords
- Session-based authentication after sign-in
- Role-based access control; every backend route requires authentication
- SQL injection protection with parameterized queries

## API Endpoints

### Authentication
- `GET /api/auth/oidc/login` - Redirects to the IdP to begin sign-in
- `GET /api/auth/oidc/callback` - OIDC callback; establishes the session
- `GET /api/auth/logout` - Ends the local session and, when supported, the IdP session (RP-initiated logout)
- `GET /api/auth/check` - Check authentication status

All other endpoints below require an authenticated session; role-restricted ones additionally require the noted role.

### Vendors
- `GET /api/vendors` - List all vendors
- `POST /api/vendors` - Create new vendor (admin only)

### Purchase Requests
- `GET /api/purchase-requests` - List purchase requests
- `GET /api/purchase-requests/:id` - Get request details
- `POST /api/purchase-requests` - Create new request
- `PUT /api/purchase-requests/:id/status` - Update request status
- `PUT /api/purchase-requests/:requestId/items/:itemId/receive` - Receive items

### Users
- `GET /api/users` - List users (admin only)
- `POST /api/users` - Create new user (admin only)

## Customization

### Changing Tax Rate
The default tax rate is 7.5%. You can:
- Adjust it per-request in the submission form
- Change the default in `public/index.html` (line with `value="7.5"`)

### Adding Vendors
Sign in as admin and use the API endpoint or add directly to the database.

### Modifying User Roles
Roles come from your OIDC provider's group membership via `OIDC_ROLE_MAP`; edit that environment variable rather than the database.

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Any modern browser with ES6 support

## Development Notes

- The database file (`purchasing.db`) is created automatically on first run
- All timestamps are stored in UTC
- The application uses SQLite's WAL mode for better concurrency
- Session data is stored in memory (use a persistent store for production)

## Future Enhancements

Potential features for future versions:
- Email notifications for approvals and receipts
- PDF export of purchase orders
- Advanced reporting and analytics
- Multi-currency support
- Vendor performance tracking
- Budget management and allocation
- File attachments (quotes, invoices)
- Mobile app version

## License

ISC

## Support

For issues or questions, please check the documentation or contact your system administrator.
