# Slack Notifications Implementation

## Overview
The purchasing tracker now supports Slack notifications for important purchase events. Notifications are fully configurable through the Admin Settings page.

## Features

### 1. **Four Notification Types**
- **New Request Submitted**: Sent when a new purchase request is created and needs approval
- **Request Approved**: Sent when a purchase request is fully approved and ready to be ordered
- **Purchase Ordered**: Sent when a purchase order is marked as ordered from the vendor
- **Order Arrived**: Sent when an order arrives and needs to be received/marked as complete

### 2. **Configurable Webhook URL**
- Set your Slack Incoming Webhook URL in the Admin Settings
- Leave empty to disable all notifications
- Get your webhook URL from: https://api.slack.com/messaging/webhooks

### 3. **Customizable Message Templates**
Each notification type has a customizable message template with variables:

**Available Variables:**
- `{{id}}` - Purchase request ID
- `{{requester}}` - Name of the person who submitted the request
- `{{vendor}}` - Vendor name
- `{{total}}` - Total amount (formatted with 2 decimal places)
- `{{requested_arrival_date}}` - Requested arrival date (formatted as "Month Day, Year" or "Not specified")

**Default Templates:**
- **New Request**: `New purchase request submitted: {{requester}} requested ${{total}} from {{vendor}} (Request #{{id}})`
- **Approved**: `Purchase request approved: Request #{{id}} for ${{total}} from {{vendor}} is ready to be ordered`
- **Ordered**: `Purchase order placed: Request #{{id}} for ${{total}} has been ordered from {{vendor}}`
- **Arrived**: `Purchase order arrived: Request #{{id}} from {{vendor}} has been received and needs to be marked as complete`

**Example with Requested Arrival Date:**
- `New purchase request: {{requester}} needs ${{total}} from {{vendor}} by {{requested_arrival_date}} (Request #{{id}})`

## Configuration

### Step 1: Create a Slack Incoming Webhook
1. Go to https://api.slack.com/messaging/webhooks
2. Click "Create your Slack app"
3. Choose "From scratch" and name your app (e.g., "Purchasing Tracker")
4. Select your workspace
5. Under "Features", click "Incoming Webhooks"
6. Toggle "Activate Incoming Webhooks" to On
7. Click "Add New Webhook to Workspace"
8. Choose the channel where notifications should be posted
9. Copy the webhook URL (looks like: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`)

### Step 2: Configure in Admin Settings
1. Login to the purchasing tracker as an admin
2. Go to the Admin page
3. Click on the "Settings" tab
4. Scroll down to "Slack Notifications"
5. Paste your webhook URL
6. **Click "Test Webhook" to verify it's working** - you should see a test message in your Slack channel
7. Customize the message templates if desired (use the variable placeholders)
8. Click "Save Settings"

## How It Works

### When Notifications Are Sent

1. **New Request Notification**
   - Triggered when a user submits a new purchase request via the public form
   - Helps approvers stay informed of pending requests

2. **Approved Notification**
   - Triggered when a request receives all required approvals (or admin approval)
   - Alerts purchasers that an order is ready to be placed

3. **Ordered Notification**
   - Triggered when a purchase order is marked as "Ordered" on the tracking page
   - Confirms that the order has been placed with the vendor

4. **Arrived Notification**
   - Triggered when the first items from an order are marked as received
   - Notifies team that items have arrived and need processing

### Technical Details
- Notifications are sent asynchronously and won't block the main application
- If sending fails, an error is logged but the application continues normally
- Empty webhook URLs are silently ignored (no notifications sent)
- Uses native Node.js HTTPS module (no additional dependencies required)

## Testing

### Quick Test
1. Enter your webhook URL in the Settings page
2. Click the "Test Webhook" button next to the URL field
3. Check your Slack channel for a test message: "🧪 Test notification from Purchasing Tracker! Your Slack integration is working correctly."

### Full Integration Test
To test all four notification types:

1. Configure your webhook URL and save settings
2. Submit a test purchase request (as any user)
3. Approve it (as an admin/approver)
4. Mark it as ordered, then mark items as received
5. Check your configured Slack channel for the four notifications

## Troubleshooting

**Notifications not appearing:**
- **Use the "Test Webhook" button first** to verify the webhook URL is working
- Verify the webhook URL is correct and complete
- Check that the Slack app has permission to post to the selected channel
- Look at the server console for any error messages
- Ensure the webhook URL starts with `https://hooks.slack.com/`

**Test webhook button shows an error:**
- Double-check that you copied the entire webhook URL from Slack
- Make sure there are no extra spaces at the beginning or end
- Verify the webhook hasn't been revoked in your Slack app settings

**Messages showing placeholder text:**
- Make sure your message templates use the correct variable syntax: `{{variableName}}`
- Valid variables: `{{id}}`, `{{requester}}`, `{{vendor}}`, `{{total}}`

## Database Schema

New settings added to the `settings` table:
- `slack_webhook_url` - The Slack webhook URL
- `slack_new_request_message` - Template for new request notifications
- `slack_approved_message` - Template for approved notifications
- `slack_ordered_message` - Template for ordered notifications
- `slack_arrived_message` - Template for arrived notifications

These settings are automatically added when the server starts if they don't exist.
