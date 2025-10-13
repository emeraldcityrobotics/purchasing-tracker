# Testing Checklist - Purchasing Tracker

Use this checklist to verify all features are working correctly.

## ✅ Authentication Tests

- [ ] Login with admin account (admin / admin123)
- [ ] Login with approver account (approver / approver123)
- [ ] Login with purchaser account (purchaser / purchaser123)
- [ ] Login with incorrect credentials (should fail)
- [ ] Logout and verify session is cleared
- [ ] Try accessing protected pages without login (should redirect)

## ✅ Purchase Request Creation Tests

### Basic Functionality
- [ ] Select a vendor from dropdown
- [ ] Add one item with all fields
- [ ] Verify line total calculates correctly
- [ ] Add multiple items (3-5 items)
- [ ] Remove an item from the list
- [ ] Verify tax calculation is accurate
- [ ] Change tax rate and verify recalculation
- [ ] Add notes to the request
- [ ] Submit the request
- [ ] Verify success message appears

### Validation Tests
- [ ] Try to submit without selecting vendor (should fail)
- [ ] Try to submit without items (should fail)
- [ ] Enter negative quantity (should validate)
- [ ] Enter negative price (should validate)
- [ ] Test with decimal prices (e.g., 19.99)
- [ ] Test with large quantities (e.g., 1000)

### Calculation Tests
Test these scenarios:
- [ ] 1 item: Qty=1, Price=$10, Tax=10% → Total should be $11
- [ ] 2 items: Qty=2, Price=$50 each, Tax=7.5% → Total should be $107.50
- [ ] 3 items: Qty=5, Price=$20 each, Tax=0% → Total should be $100

## ✅ Approval Workflow Tests

### Access Control
- [ ] Login as purchaser - verify "Approvals" tab shows access denied
- [ ] Login as approver - verify can access approvals page
- [ ] Login as admin - verify can access approvals page

### Approval Functions
- [ ] View list of pending requests
- [ ] Click "View" on a request
- [ ] Verify all request details are displayed correctly
- [ ] Approve a request
- [ ] Verify success message
- [ ] Verify status changed to "Approved"
- [ ] Verify approver name and date are recorded

### Rejection Functions
- [ ] View a pending request
- [ ] Reject the request
- [ ] Confirm rejection dialog
- [ ] Verify status changed to "Rejected"

## ✅ Order Tracking Tests

### Viewing Orders
- [ ] View all orders in the tracking page
- [ ] Filter by "Pending" status
- [ ] Filter by "Approved" status
- [ ] Filter by "Ordered" status
- [ ] Filter by "Completed" status
- [ ] Verify progress bars display correctly
- [ ] Click "Track & Receive" on an order

### Order Processing
- [ ] View an approved order
- [ ] Click "Mark as Ordered"
- [ ] Verify status changes to "Ordered"
- [ ] Verify order appears in "Ordered" filter

### Receiving Items
- [ ] Open an ordered purchase request
- [ ] Receive full quantity of one item
- [ ] Verify item marked as complete (✓)
- [ ] Verify progress bar updates
- [ ] Receive partial quantity of another item
- [ ] Verify status changes to "Partially Received"
- [ ] Receive remaining quantity
- [ ] Verify all items are complete
- [ ] Verify status changes to "Completed"
- [ ] Verify progress shows 100%

## ✅ Navigation Tests

- [ ] Navigate from "New Request" to "Approvals"
- [ ] Navigate from "Approvals" to "Track Orders"
- [ ] Navigate from "Track Orders" to "New Request"
- [ ] Verify correct tab is highlighted
- [ ] Use browser back button - verify still works
- [ ] Refresh page - verify session persists

## ✅ Role-Based Access Tests

### As Purchaser
- [ ] Can create requests ✓
- [ ] Cannot approve requests ✗
- [ ] Can view own requests only ✓
- [ ] Can track orders ✓
- [ ] Can receive items ✓

### As Approver
- [ ] Can create requests ✓
- [ ] Can approve requests ✓
- [ ] Can view all requests ✓
- [ ] Can track orders ✓
- [ ] Can receive items ✓

### As Admin
- [ ] Can create requests ✓
- [ ] Can approve requests ✓
- [ ] Can view all requests ✓
- [ ] Can track orders ✓
- [ ] Can receive items ✓
- [ ] Can manage users ✓

## ✅ Data Persistence Tests

- [ ] Create a purchase request
- [ ] Logout
- [ ] Login with different account
- [ ] Verify request still exists
- [ ] Approve the request
- [ ] Logout and login again
- [ ] Verify approval persisted
- [ ] Stop server (Ctrl+C)
- [ ] Restart server (npm start)
- [ ] Login and verify all data persisted

## ✅ UI/UX Tests

### Visual Elements
- [ ] Header displays correctly
- [ ] User name displays in header
- [ ] User role badge displays correctly
- [ ] Navigation tabs styled correctly
- [ ] Cards and forms are properly aligned
- [ ] Buttons have hover effects
- [ ] Status badges have correct colors
- [ ] Modal opens and closes properly
- [ ] Tables display correctly
- [ ] Progress bars render correctly

### Responsive Design (resize browser)
- [ ] Test at 1920px width
- [ ] Test at 1366px width
- [ ] Test at 768px width
- [ ] Test at 375px width
- [ ] Verify layout adjusts appropriately

### Messages and Feedback
- [ ] Success messages appear and auto-hide
- [ ] Error messages appear and auto-hide
- [ ] Loading states show appropriately
- [ ] Confirmation dialogs work correctly

## ✅ Complete Workflow Test

This tests the entire system end-to-end:

1. **Setup**
   - [ ] Fresh browser session
   - [ ] Server is running

2. **Create Request (as Purchaser)**
   - [ ] Login as purchaser
   - [ ] Create new request with 3 items:
     - Item 1: Office Chairs, Qty: 10, Price: $150
     - Item 2: Desks, Qty: 5, Price: $300
     - Item 3: Monitors, Qty: 15, Price: $200
   - [ ] Verify total: $7,500 + tax
   - [ ] Submit request
   - [ ] Note the request ID

3. **Approve Request (as Approver)**
   - [ ] Logout and login as approver
   - [ ] Go to Approvals tab
   - [ ] Find the request by ID
   - [ ] View details
   - [ ] Approve the request
   - [ ] Verify approval confirmed

4. **Order Items (as Purchaser)**
   - [ ] Logout and login as purchaser
   - [ ] Go to Track Orders tab
   - [ ] Find the approved request
   - [ ] Click "Track & Receive"
   - [ ] Click "Mark as Ordered"
   - [ ] Verify status is "Ordered"

5. **Receive Items (as Purchaser)**
   - [ ] Open the ordered request
   - [ ] Receive 10 Office Chairs (full quantity)
   - [ ] Verify item marked complete
   - [ ] Receive 3 Desks (partial)
   - [ ] Verify status is "Partially Received"
   - [ ] Verify progress bar updated
   - [ ] Receive remaining 2 Desks
   - [ ] Receive all 15 Monitors
   - [ ] Verify status is "Completed"
   - [ ] Verify progress shows 100%

6. **Verification**
   - [ ] Check order in "Completed" filter
   - [ ] Verify all items show as received
   - [ ] Verify dates are recorded
   - [ ] Logout

## ✅ Error Handling Tests

- [ ] Submit form with missing required fields
- [ ] Try SQL injection in text fields
- [ ] Enter extremely large numbers
- [ ] Enter special characters in text fields
- [ ] Try to access API endpoints without authentication
- [ ] Try to access API endpoints with wrong role

## ✅ Performance Tests

- [ ] Create request with 20+ items
- [ ] Load page with 50+ requests
- [ ] Rapidly switch between tabs
- [ ] Submit multiple requests quickly
- [ ] Open and close modal repeatedly

## 🎯 Test Results Summary

After completing all tests, fill out:

- **Total Tests**: ___
- **Tests Passed**: ___
- **Tests Failed**: ___
- **Critical Issues**: ___
- **Minor Issues**: ___

## 🐛 Bug Report Template

If you find issues, document them:

```
Bug ID: [Sequential number]
Severity: [Critical / High / Medium / Low]
Title: [Brief description]
Steps to Reproduce:
1. 
2. 
3. 
Expected Result: 
Actual Result: 
User Role: [Admin / Approver / Purchaser]
Browser: [Chrome / Firefox / Safari / Edge]
Screenshots: [If applicable]
```

## ✨ Feature Suggestions

Document any improvements or new features:

```
Feature: [Name]
Description: [What it does]
Benefit: [Why it's useful]
Priority: [High / Medium / Low]
```

---

**Note**: Check off each item as you test. If any test fails, document it in the Bug Report section and continue with remaining tests.
