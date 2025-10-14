# Changelog - Requested Arrival Date Feature

## Date: October 13, 2025

### Summary
Added comprehensive "Requested Arrival Date" functionality to the purchasing tracker system, allowing requesters to specify when they need items to arrive. The feature integrates seamlessly with the existing Frappe-inspired design system.

---

## Backend Changes

### server.js

#### 1. Database Migration (Lines ~160-165)
```javascript
// Add requested_arrival_date column if it doesn't exist (migration)
try {
    db.exec(`ALTER TABLE purchase_requests ADD COLUMN requested_arrival_date TEXT`);
    console.log('Added requested_arrival_date column to purchase_requests table');
} catch (error) {
    // Column already exists, ignore
}
```

#### 2. Helper Function (Lines ~268-272)
```javascript
// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
```

#### 3. Slack Notification Update (Lines ~305-310)
```javascript
// Replace placeholders with actual data
let message = messageTemplate
    .replace(/\{\{id\}\}/g, requestData.id || '')
    .replace(/\{\{requester\}\}/g, requestData.requester_name || '')
    .replace(/\{\{vendor\}\}/g, requestData.vendor_name || '')
    .replace(/\{\{total\}\}/g, requestData.total ? requestData.total.toFixed(2) : '0.00')
    .replace(/\{\{requested_arrival_date\}\}/g, requestData.requested_arrival_date ? formatDate(requestData.requested_arrival_date) : 'Not specified');
```

#### 4. Public API Endpoint (Line ~428)
- Added `requested_arrival_date` to request body destructuring
- Updated INSERT statement to include the new column
- Added to Slack notification data

#### 5. Authenticated API Endpoint (Line ~664)
- Added `requested_arrival_date` to request body destructuring
- Updated INSERT statement to include the new column
- Added to Slack notification data

---

## Frontend Changes

### index.html (Public Request Form)

#### New Form Field (Lines ~100-105)
```html
<div class="form-group">
    <label for="requestedArrivalDate">Requested Arrival Date</label>
    <input type="date" id="requestedArrivalDate" placeholder="When do you need these items?">
    <small style="color: var(--text-muted);">Optional: Specify when you need these items to arrive</small>
</div>
```

#### JavaScript Update (Lines ~450, ~485)
- Added field value retrieval
- Included in POST request body

---

### approval.html (Approval Page)

#### Display Section (Lines ~295-302)
```javascript
${currentRequest.requested_arrival_date ? `
    <div class="callout callout-info">
        <strong>📅 Requested Arrival Date</strong>
        <span class="callout-date">${formatDate(currentRequest.requested_arrival_date)}</span>
    </div>
` : ''}
```

#### Helper Function (Lines ~424-428)
```javascript
function formatDate(dateString) {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
```

---

### tracking.html (Order Tracking Page)

#### Display Section (Lines ~378-385)
```javascript
${currentRequest.requested_arrival_date ? `
    <div class="callout callout-info">
        <strong>📅 Requested Arrival Date</strong>
        <span class="callout-date">${formatDate(currentRequest.requested_arrival_date)}</span>
    </div>
` : ''}
```

#### Helper Function (Lines ~509-513)
```javascript
function formatDate(dateString) {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
```

---

### admin.html (Admin Settings)

#### Updated Variable Lists (Lines ~198, 204, 210, 216)
Changed all Slack template descriptions from:
```
Variables: {{id}}, {{vendor}}, {{total}}
```

To:
```
Variables: {{id}}, {{vendor}}, {{total}}, {{requested_arrival_date}}
```

---

## Style Changes

### styles.css

#### New CSS Classes (Lines ~618-648)
```css
/* Callout boxes - Frappe Style */
.callout {
    margin-top: 20px;
    padding: 16px;
    border-radius: 6px;
    border: 1px solid;
}

.callout-warning {
    background: #FFF3CD;
    border-color: #FFE69C;
    color: #856404;
}

.callout-info {
    background: #D1ECF1;
    border-color: #BEE5EB;
    color: #0C5460;
}

.callout strong {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
}

.callout-date {
    font-size: 16px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}
```

---

## Documentation Updates

### SLACK_NOTIFICATIONS.md

#### Updated Available Variables Section
- Added `{{requested_arrival_date}}` to the variables list
- Added description and example usage

#### Example Template
```
New purchase request: {{requester}} needs ${{total}} from {{vendor}} by {{requested_arrival_date}} (Request #{{id}})
```

---

### REQUESTED_ARRIVAL_DATE.md

- Comprehensive feature documentation
- Usage examples for all user roles
- Technical details and API specifications
- Best practices guide
- CSS class documentation

---

## Database Schema Change

```sql
ALTER TABLE purchase_requests ADD COLUMN requested_arrival_date TEXT;
```

**Properties:**
- Type: TEXT (stores ISO date string YYYY-MM-DD)
- Nullable: YES
- Default: NULL

---

## Testing Checklist

- [ ] Database migration runs without errors
- [ ] Public form accepts and submits date
- [ ] Authenticated form accepts and submits date
- [ ] Date displays correctly on approval page
- [ ] Date displays correctly on tracking page
- [ ] Slack notifications include formatted date
- [ ] Null dates show "Not specified" in notifications
- [ ] CSS styling matches Frappe design system
- [ ] Date picker works in all supported browsers
- [ ] Mobile responsive design maintained

---

## Breaking Changes

**None** - This is a fully backward-compatible feature addition.

---

## Rollback Plan

If needed, the feature can be safely removed by:
1. Reverting to previous commit
2. The column will remain in the database but will not be used
3. No data loss will occur

---

## Future Enhancements

Potential improvements for future versions:
- Date validation (prevent past dates)
- Automatic reminders before arrival date
- Dashboard with upcoming arrivals
- Urgency indicators based on how close the date is
- Vendor lead time suggestions
