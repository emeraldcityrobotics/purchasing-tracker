# Requested Arrival Date Feature

## Overview
The purchasing tracker now supports a "Requested Arrival Date" field that allows requesters to specify when they need items to arrive. This date is displayed prominently throughout the system with consistent Frappe-inspired styling and can be included in Slack notifications.

## Features Added

### 1. Database Changes
- Added `requested_arrival_date` column to `purchase_requests` table (TEXT type, nullable)
- Migration automatically runs on server startup for existing databases
- Stores dates in ISO format (YYYY-MM-DD)

### 2. Public Request Form (index.html)
- New date input field on the purchase request form
- Optional field with helpful description: "Optional: Specify when you need these items to arrive"
- Located after the "Notes" field for easy visibility
- Uses HTML5 date picker for easy date selection
- Submits the date with the purchase request

### 3. Slack Notifications
- New variable available in all notification templates: `{{requested_arrival_date}}`
- Automatically formats dates as "Month Day, Year" (e.g., "October 15, 2025")
- Shows "Not specified" if no date is provided
- Added helper function `formatDate()` to server.js
- Works in all four notification types:
  - New Request Submitted
  - Request Approved
  - Purchase Ordered
  - Order Arrived

### 4. Approval Page (approval.html)
- Displays requested arrival date in a prominent info callout box
- Uses new `.callout` and `.callout-info` CSS classes
- Shows with calendar emoji (📅) for easy visual identification
- Formatted with `.callout-date` class for consistent styling
- Only shows when a date is specified
- Includes `formatDate()` JavaScript function

### 5. Tracking Page (tracking.html)
- Same prominent display as approval page
- Uses matching `.callout` CSS classes
- Visible to all staff viewing order status
- Helps purchasers prioritize orders
- Includes `formatDate()` JavaScript function

### 6. Admin Settings (admin.html)
- Updated all Slack message template variable lists
- All four templates now show `{{requested_arrival_date}}` as available variable
- Admins can customize notification messages to include the date

### 7. CSS Styling Updates (styles.css)
- Added new `.callout` base class for callout boxes
- Added `.callout-warning` for notes (yellow background)
- Added `.callout-info` for arrival date (blue background)
- Added `.callout-date` for formatted date display
- Follows Frappe-inspired design system with proper colors and spacing

## Usage Examples

### Example Slack Notification Templates

**New Request with Date:**
```
New purchase request: {{requester}} needs ${{total}} from {{vendor}} by {{requested_arrival_date}} (Request #{{id}})
```

**Approved with Urgency:**
```
✅ Request #{{id}} approved! Order ${{total}} from {{vendor}} - needed by {{requested_arrival_date}}
```

**Ordered with Timeline:**
```
Order placed with {{vendor}} for ${{total}} - Target arrival: {{requested_arrival_date}} (Request #{{id}})
```

## Technical Details

### API Endpoints Updated
1. **POST /api/purchase-requests** (authenticated)
   - Accepts `requested_arrival_date` in request body
   - Stores in database

2. **POST /api/public/purchase-requests** (public)
   - Accepts `requested_arrival_date` in request body
   - Stores in database

### Helper Functions Added
- `formatDate(dateString)` - Server-side (server.js)
  - Converts ISO date string to readable format
  - Returns "Not specified" for null/empty dates

- `formatDate(dateString)` - Client-side (approval.html, tracking.html)
  - JavaScript version for consistent formatting
  - Uses `toLocaleDateString()` for localization

### Notification Updates
All `sendSlackNotification()` calls now include the `requested_arrival_date` field:
- New request notifications
- Approval notifications  
- Ordered notifications
- Arrived notifications

## Benefits

1. **Better Planning**: Requesters can communicate urgency and deadlines
2. **Prioritization**: Purchasers can prioritize orders based on need date
3. **Accountability**: Clear expectations for delivery timeline
4. **Visibility**: Date shows in approval workflow and tracking
5. **Notifications**: Slack alerts can include the deadline for quick reference

## Backward Compatibility

- Existing purchase requests without dates continue to work
- Date field is optional - not required to submit requests
- Shows "Not specified" in notifications when no date provided
- All existing functionality remains unchanged
