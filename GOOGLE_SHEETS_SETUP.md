# Google Sheets Setup Guide

This guide will help you set up Google Sheets integration for the purchasing tracker application using Google Apps Script webhooks.

## Prerequisites

1. A Google account
2. A Google Sheets document where you want to export purchase data

## Setup Steps

### Step 1: Prepare Your Google Sheet

1. Create a new Google Sheets document or open an existing one
2. Note down the Sheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit#gid=0
   ```

### Step 2: Create Google Apps Script Webhook

1. Open the admin panel of your purchasing tracker application
2. Navigate to the Google Sheets settings section
3. Click "Show Apps Script Code"
4. Follow the instructions in the modal:
   - Go to [script.google.com](https://script.google.com)
   - Create a new project
   - Replace the default code with the provided code
   - Change `YOUR_GOOGLE_SHEET_ID_HERE` to your actual Sheet ID
   - Deploy → New deployment → Type: Web app
   - Execute as: Me, Access: Anyone
   - Copy the webhook URL

### Step 3: Configure the Application

1. Back in the admin panel, paste the webhook URL you copied
2. Optionally, specify the sheet name (defaults to "Sheet1")
3. Click "Save Google Sheets Settings"

## Apps Script Code

If you need to manually create the Apps Script, here's the code (also available through the admin interface):

```javascript
function doPost(e) {
  try {
    // Replace with your actual Google Sheet ID
    const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';
    const SHEET_NAME = 'Sheet1'; // Change if using a different sheet name
    
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    
    // Check if headers exist, if not create them
    if (sheet.getLastRow() === 0) {
      const headers = [
        'Purchase ID', 'User', 'Description', 'Estimated Amount', 
        'Actual Amount', 'Status', 'Order Date', 'Estimated Delivery', 'Tracking Number'
      ];
      sheet.appendRow(headers);
    }
    
    // Add the purchase data
    const row = [
      data.id,
      data.user,
      data.description,
      data.estimated_amount,
      data.actual_amount_spent || data.estimated_amount,
      data.status,
      data.created_at,
      data.estimated_delivery_date || '',
      data.tracking_number || ''
    ];
    
    sheet.appendRow(row);
    
    return ContentService
      .createTextOutput(JSON.stringify({success: true, message: 'Data added successfully'}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Sheet Structure

The application will create headers and add data to your sheet in this format:

| Purchase ID | User | Description | Estimated Amount | Actual Amount | Status | Order Date | Estimated Delivery | Tracking Number |
|-------------|------|-------------|------------------|---------------|--------|------------|-------------------|-----------------|
| 1 | john.doe | Office supplies | $50.00 | $45.23 | approved | 2024-01-15 | 2024-01-20 | 1Z999AA1234567890 |

## Testing the Integration

1. Place a test order through the application
2. Approve the order (if approval workflow is enabled)
3. Check your Google Sheet - the data should appear automatically
4. You can also use the manual export button in the tracking interface

## Advantages of Apps Script Approach

- **No Service Account needed** - Uses your Google account permissions
- **Simpler setup** - No Google Cloud Console configuration required
- **Direct access** - Apps Script runs with your Google account permissions
- **Free** - No additional costs for API usage
- **Secure** - Webhook URL is the only credential needed

## Troubleshooting

### Common Issues

1. **Webhook URL not working**
   - Ensure you deployed the Apps Script as a web app
   - Check that access is set to "Anyone"
   - Verify the webhook URL is complete and correct

2. **"Script not found" errors**
   - Make sure the Apps Script project is deployed
   - Check that the deployment is published and not in draft mode

3. **Data not appearing**
   - Check the sheet name matches what you configured in the script
   - Verify the Sheet ID is correct in the Apps Script code
   - Check that the purchase has been approved (if approval workflow is enabled)

4. **Permission errors**
   - The first time the script runs, you may need to authorize it
   - Check the Apps Script execution logs for permission prompts

5. **HTTP 302 responses**
   - Google Apps Script often returns 302 redirect responses even when successful
   - This is normal behavior and indicates the webhook is working correctly
   - Check your Google Sheet to verify data was actually added

### Logs

- Check the application logs for HTTP response details
- View Apps Script execution logs at script.google.com under your project
- The integration will log successful exports and any errors that occur
- **Note**: Google Apps Script may return a 302 redirect status code even on successful execution - this is normal behavior

## Security Notes

- The webhook URL acts as the authentication mechanism
- Keep your webhook URL secure and don't share it publicly
- Apps Script runs with your Google account permissions
- Consider the security implications of allowing "Anyone" access to the web app

## Migration from Service Account

If you were previously using the Service Account approach:

1. The webhook URL field replaces the service account JSON field
2. No need to share sheets with service accounts anymore
3. The Apps Script will have access to sheets in your Google account
4. All existing functionality remains the same