# System Overview - Purchasing Tracker

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Purchase     │  │  Approval    │  │   Tracking   │      │
│  │ Request Form │  │  Interface   │  │   Dashboard  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/AJAX
┌─────────────────────────────────────────────────────────────┐
│                   Express Server (Node.js)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Authentication Middleware                │   │
│  │         (Session Management + Role Check)            │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   API Endpoints                       │   │
│  │  • /api/login             • /api/vendors             │   │
│  │  • /api/purchase-requests • /api/users               │   │
│  │  • /api/auth/check        • /api/.../status          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ SQL
┌─────────────────────────────────────────────────────────────┐
│                   SQLite Database                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐          │
│  │  users   │  │ vendors  │  │ purchase_requests│          │
│  └──────────┘  └──────────┘  └──────────────────┘          │
│                               ┌──────────────────────────┐  │
│                               │purchase_request_items    │  │
│                               └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## User Roles & Permissions

```
┌──────────────────────────────────────────────────────────────┐
│                          ADMIN                                │
│  ✓ Create purchase requests                                  │
│  ✓ Approve/reject requests                                   │
│  ✓ Track and receive orders                                  │
│  ✓ Manage users                                              │
│  ✓ Manage vendors                                            │
│  ✓ Full system access                                        │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                        APPROVER                               │
│  ✓ Create purchase requests                                  │
│  ✓ Approve/reject requests                                   │
│  ✓ Track and receive orders                                  │
│  ✗ Manage users                                              │
│  ✗ Manage vendors                                            │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                       PURCHASER                               │
│  ✓ Create purchase requests                                  │
│  ✗ Approve/reject requests                                   │
│  ✓ Track own orders                                          │
│  ✓ Receive items                                             │
│  ✗ Manage users                                              │
│  ✗ Manage vendors                                            │
└──────────────────────────────────────────────────────────────┘
```

## Purchase Request Workflow

```
┌─────────────┐
│   PENDING   │  ← New request created
└──────┬──────┘
       │
       ├─────────────┐
       │             │
       ↓             ↓
┌─────────────┐  ┌──────────┐
│  APPROVED   │  │ REJECTED │  ← Approver decision
└──────┬──────┘  └──────────┘
       │
       ↓
┌─────────────┐
│   ORDERED   │  ← Purchaser places order
└──────┬──────┘
       │
       ↓
┌─────────────────────┐
│ PARTIALLY_RECEIVED  │  ← Some items received
└──────┬──────────────┘
       │
       ↓
┌─────────────┐
│  COMPLETED  │  ← All items received
└─────────────┘
```

## Database Schema

```
┌──────────────────────────┐
│         users            │
├──────────────────────────┤
│ id (PK)                  │
│ username (UNIQUE)        │
│ password (hashed)        │
│ role                     │
│ full_name                │
│ created_at               │
└──────────────────────────┘

┌──────────────────────────┐
│        vendors           │
├──────────────────────────┤
│ id (PK)                  │
│ name (UNIQUE)            │
│ contact_person           │
│ email                    │
│ phone                    │
│ created_at               │
└──────────────────────────┘

┌─────────────────────────────────┐
│      purchase_requests          │
├─────────────────────────────────┤
│ id (PK)                         │
│ vendor_id (FK → vendors)        │
│ requester_id (FK → users)       │
│ status                          │
│ subtotal                        │
│ tax_amount                      │
│ total                           │
│ notes                           │
│ approved_by (FK → users)        │
│ approved_at                     │
│ created_at                      │
└─────────────────────────────────┘
             │
             │ 1:N
             ↓
┌─────────────────────────────────┐
│   purchase_request_items        │
├─────────────────────────────────┤
│ id (PK)                         │
│ purchase_request_id (FK)        │
│ product_name                    │
│ description                     │
│ quantity                        │
│ unit_price                      │
│ line_total                      │
│ quantity_received               │
│ received_at                     │
└─────────────────────────────────┘
```

## Page Flow

```
                 ┌─────────────┐
                 │   LOGIN     │
                 └──────┬──────┘
                        │
                        ↓
        ┌───────────────────────────────┐
        │                               │
        ↓                               ↓
┌────────────────┐            ┌──────────────────┐
│ NEW REQUEST    │            │   APPROVALS      │
│                │            │                  │
│ • Select vendor│            │ • View requests  │
│ • Add items    │            │ • Approve/reject │
│ • Calculate tax│            │ • View details   │
│ • Add notes    │            └──────────────────┘
│ • Submit       │
└────────────────┘            ┌──────────────────┐
                              │  TRACK ORDERS    │
                              │                  │
                              │ • Filter status  │
                              │ • View progress  │
                              │ • Mark ordered   │
                              │ • Receive items  │
                              └──────────────────┘
```

## Key Features Summary

### 1. Purchase Request Form
- **Dynamic item management**: Add/remove items on the fly
- **Real-time calculations**: Automatic subtotal, tax, and total
- **Vendor selection**: Dropdown of available vendors
- **Notes support**: Additional instructions or requirements

### 2. Approval System
- **Role-based access**: Only admins and approvers can approve
- **Detailed review**: View full request details before decision
- **Audit trail**: Tracks who approved and when
- **Status management**: Approve or reject with one click

### 3. Order Tracking
- **Status filtering**: View orders by current status
- **Progress visualization**: Progress bars for receiving status
- **Partial receiving**: Track individual item quantities
- **Automatic completion**: Status updates when all items received

### 4. Security Features
- **Password hashing**: bcrypt with 10 salt rounds
- **Session management**: Secure server-side sessions
- **Role-based access**: Different permissions per role
- **CSRF protection**: Session validation on all API calls

## Technology Stack

```
Frontend:
  • HTML5
  • CSS3 (Custom styling with gradients)
  • Vanilla JavaScript (ES6+)
  • AJAX (Fetch API)

Backend:
  • Node.js (Runtime)
  • Express.js (Web framework)
  • express-session (Session management)
  • bcryptjs (Password hashing)
  • body-parser (Request parsing)

Database:
  • SQLite (better-sqlite3)
  • WAL mode (Write-Ahead Logging)
  • ACID compliance
  • Foreign key constraints
```

## File Structure

```
purchasing-tracker/
│
├── server.js                 # Main server file
│   ├── Database initialization
│   ├── Middleware setup
│   ├── API routes
│   └── Authentication logic
│
├── package.json              # Dependencies
│
├── purchasing.db             # SQLite database (auto-created)
│
├── public/                   # Static files
│   ├── index.html           # Purchase request form
│   ├── approval.html        # Approval interface
│   ├── tracking.html        # Order tracking
│   └── styles.css           # All styling
│
├── README.md                 # Full documentation
├── QUICKSTART.md            # Quick start guide
└── .gitignore               # Git ignore rules
```

## API Endpoints Overview

```
Authentication:
  POST   /api/login          → Login user
  POST   /api/logout         → Logout user
  GET    /api/auth/check     → Check auth status

Vendors:
  GET    /api/vendors        → List vendors
  POST   /api/vendors        → Create vendor (admin)

Purchase Requests:
  GET    /api/purchase-requests        → List all requests
  GET    /api/purchase-requests/:id    → Get request details
  POST   /api/purchase-requests        → Create request
  PUT    /api/purchase-requests/:id/status  → Update status
  PUT    /api/purchase-requests/:rid/items/:iid/receive  → Receive items

Users:
  GET    /api/users          → List users (admin)
  POST   /api/users          → Create user (admin)
```

## Default Data

### Users (3 accounts)
1. **admin** - Full system access
2. **approver** - Can approve requests
3. **purchaser** - Can submit and track

### Vendors (3 vendors)
1. **Office Supplies Inc** - Office equipment
2. **Tech Solutions Ltd** - Technology products
3. **Industrial Equipment Co** - Industrial supplies

## Session Flow

```
1. User enters credentials
        ↓
2. Server validates password (bcrypt)
        ↓
3. Session created with user info
        ↓
4. Session cookie sent to browser
        ↓
5. Browser includes cookie in requests
        ↓
6. Server validates session
        ↓
7. Access granted based on role
```

## Performance Considerations

- **Database**: SQLite WAL mode for concurrent reads
- **Sessions**: In-memory storage (use Redis for production)
- **Static files**: Served directly by Express
- **No build step**: Direct HTML/CSS/JS serving
- **Lightweight**: Minimal dependencies

## Future Enhancements Roadmap

1. **Phase 1**: Email notifications
2. **Phase 2**: PDF export functionality
3. **Phase 3**: Advanced reporting
4. **Phase 4**: Mobile responsive improvements
5. **Phase 5**: Real-time updates (WebSockets)
6. **Phase 6**: Multi-tenant support
7. **Phase 7**: Budget management
8. **Phase 8**: Inventory integration
