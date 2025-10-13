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
- Password-protected approval interface for admin and approver roles
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

### 🔐 Multi-User Authentication System
- Secure password authentication with bcrypt hashing
- Three user roles with different permissions:
  - **Admin**: Full system access
  - **Approver**: Can approve/reject purchase requests
  - **Purchaser**: Can submit requests and track orders
- Session-based authentication
- Role-based access control

## Technology Stack

- **Backend**: Node.js with Express
- **Database**: SQLite with better-sqlite3
- **Authentication**: bcryptjs with express-session
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Styling**: Custom CSS with modern gradient design

## Installation

1. Make sure you have Node.js installed (version 14 or higher)

2. Install dependencies:
```bash
npm install
```

## Running the Application

Start the server:
```bash
npm start
```

The application will be available at: `http://localhost:3000`

## Default User Accounts

The system comes with three pre-configured accounts for testing:

| Username  | Password     | Role      | Capabilities                                    |
|-----------|--------------|-----------|------------------------------------------------|
| admin     | admin123     | Admin     | Full access to all features                     |
| approver  | approver123  | Approver  | Can approve/reject purchase requests            |
| purchaser | purchaser123 | Purchaser | Can submit requests and track orders            |

**Important**: Change these passwords in production!

## Usage Guide

### Creating a Purchase Request

1. Log in with any account
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

1. Log in with an admin or approver account
2. Go to "Approvals" tab
3. View the list of pending requests
4. Click "View" to see detailed information
5. Click "Approve" or "Reject" to process the request

### Tracking and Receiving Orders

1. Log in with any account
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
├── server.js              # Express server and API endpoints
├── package.json           # Node.js dependencies
├── purchasing.db          # SQLite database (created on first run)
└── public/
    ├── index.html         # Purchase request submission form
    ├── approval.html      # Approval interface
    ├── tracking.html      # Order tracking and receiving
    └── styles.css         # Application styling
```

## Security Features

- Password hashing with bcrypt (10 salt rounds)
- Session-based authentication
- Role-based access control
- CSRF protection through session validation
- SQL injection protection with parameterized queries

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/auth/check` - Check authentication status

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
Log in as admin and use the API endpoint or add directly to the database.

### Modifying User Roles
Edit the `role` field in the `users` table. Valid values: `admin`, `approver`, `purchaser`

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
