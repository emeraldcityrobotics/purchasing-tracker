# Quick Start Guide - Purchasing Tracker

## Getting Started in 3 Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

### 3. Open Your Browser
Navigate to: **http://localhost:3000**

## Demo Accounts

### Admin Account
- **Username**: admin
- **Password**: admin123
- **Can do**: Everything (create requests, approve, track, manage users)

### Approver Account
- **Username**: approver
- **Password**: approver123
- **Can do**: Approve/reject purchase requests, track orders

### Purchaser Account
- **Username**: purchaser
- **Password**: purchaser123
- **Can do**: Submit purchase requests, track orders

## Quick Tutorial

### Creating Your First Purchase Request

1. **Login** as any user (try `purchaser` / `purchaser123`)

2. **Fill out the form**:
   - Select a vendor (e.g., "Office Supplies Inc")
   - Add items:
     - Product: "Desk Chairs"
     - Quantity: 10
     - Unit Price: 150.00
   - Tax automatically calculates
   - Add notes if needed

3. **Submit** the request

### Approving a Request

1. **Login** as approver (`approver` / `approver123`)

2. **Go to "Approvals" tab**

3. **Click "View"** on any pending request

4. **Review details** and click "Approve"

### Tracking an Order

1. **Login** as admin or purchaser

2. **Go to "Track Orders" tab**

3. **Click "Track & Receive"** on an approved order

4. **Mark as Ordered** when you place the order

5. **Receive items** as they arrive:
   - Enter quantity received
   - Click "Receive"
   - Progress bar updates automatically

## Common Workflows

### Standard Purchase Flow
```
Purchaser creates request
    ↓
Approver reviews & approves
    ↓
Purchaser marks as ordered
    ↓
Items arrive and are received
    ↓
Order marked complete
```

### Adding More Items to Request
- Click the "Add Item" button
- Fill in product details
- Click "Add Item" again for more products
- Remove unwanted items with "Remove" button

### Filtering Orders
Use the status filter dropdown to view:
- All orders
- Pending approval
- Approved orders
- Rejected requests
- Active orders
- Partially received
- Completed orders

## Tips & Tricks

### Tax Calculation
- Default tax rate: 7.5%
- Change it per-request in the form
- Automatically recalculates when you change items

### Multiple Items
- No limit on items per request
- Each item tracks separately
- Line totals calculate automatically

### Receiving Items
- Can receive partial quantities
- Multiple receiving sessions supported
- Automatically tracks completion

### Progress Tracking
- Visual progress bars show receiving status
- Percentage complete displayed
- Status updates in real-time

## Troubleshooting

### Can't Login?
- Check username and password (case-sensitive)
- Try the default accounts listed above
- Clear browser cache and cookies

### Server Won't Start?
- Check if port 3000 is available
- Make sure Node.js is installed
- Run `npm install` first

### Changes Not Showing?
- Refresh the browser (F5)
- Check server is still running
- Clear browser cache

## Need Help?

- Read the full README.md for detailed documentation
- Check the database schema in README.md
- Review API endpoints in README.md
- Test with the demo accounts provided

## Security Note

**Important**: The demo passwords are for testing only!

For production use:
1. Change all default passwords
2. Use HTTPS (set `secure: true` in session config)
3. Add environment variables for secrets
4. Implement password reset functionality
5. Add email verification

## Next Steps

1. Try creating a complete purchase workflow
2. Test with different user roles
3. Explore all three interfaces
4. Customize vendors and items
5. Review the reporting features

Enjoy using your Purchasing Tracker! 🛒
