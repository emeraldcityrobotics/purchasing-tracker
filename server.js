const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = 3000;

// Configuration
const MULTI_APPROVAL_THRESHOLD = 1000; // Dollar amount requiring 5 approvals
const REQUIRED_APPROVALS = 5; // Number of approvals needed for high-value purchases

// Initialize database
const db = new Database('purchasing.db');
db.pragma('journal_mode = WAL');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'purchasing-tracker-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize database tables
function initializeDatabase() {
    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'approver', 'purchaser')),
            full_name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Departments table
    db.exec(`
        CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Vendors table
    db.exec(`
        CREATE TABLE IF NOT EXISTS vendors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            contact_person TEXT,
            email TEXT,
            phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Purchase requests table
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER NOT NULL,
            department_id INTEGER,
            requester_id INTEGER NOT NULL,
            requester_name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'ordered', 'partially_received', 'completed')),
            subtotal REAL NOT NULL,
            tax_amount REAL NOT NULL,
            total REAL NOT NULL,
            notes TEXT,
            approved_by INTEGER,
            approved_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vendor_id) REFERENCES vendors(id),
            FOREIGN KEY (department_id) REFERENCES departments(id),
            FOREIGN KEY (requester_id) REFERENCES users(id),
            FOREIGN KEY (approved_by) REFERENCES users(id)
        )
    `);

    // Purchase request items table
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_request_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_request_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            description TEXT,
            purchase_link TEXT,
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            line_total REAL NOT NULL,
            quantity_received INTEGER DEFAULT 0,
            received_at DATETIME,
            FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE
        )
    `);

    // Add purchase_link column if it doesn't exist (migration)
    try {
        db.exec(`ALTER TABLE purchase_request_items ADD COLUMN purchase_link TEXT`);
        console.log('Added purchase_link column to purchase_request_items table');
    } catch (error) {
        // Column already exists or other error, ignore
    }

    // Add department_id and requester_name columns if they don't exist (migration)
    try {
        db.exec(`ALTER TABLE purchase_requests ADD COLUMN department_id INTEGER REFERENCES departments(id)`);
        console.log('Added department_id column to purchase_requests table');
    } catch (error) {
        // Column already exists, ignore
    }

    try {
        db.exec(`ALTER TABLE purchase_requests ADD COLUMN requester_name TEXT NOT NULL DEFAULT 'Unknown'`);
        console.log('Added requester_name column to purchase_requests table');
    } catch (error) {
        // Column already exists, ignore
    }

    // Add shipping_cost column if it doesn't exist (migration)
    try {
        db.exec(`ALTER TABLE purchase_requests ADD COLUMN shipping_cost REAL DEFAULT 0`);
        console.log('Added shipping_cost column to purchase_requests table');
    } catch (error) {
        // Column already exists, ignore
    }

    // Add approver_id to departments table (migration)
    try {
        db.exec(`ALTER TABLE departments ADD COLUMN approver_id INTEGER REFERENCES users(id)`);
        console.log('Added approver_id column to departments table');
    } catch (error) {
        // Column already exists, ignore
    }

    // Add multi-approval fields to purchase_requests table (migration)
    try {
        db.exec(`ALTER TABLE purchase_requests ADD COLUMN requires_multi_approval INTEGER DEFAULT 0`);
        console.log('Added requires_multi_approval column to purchase_requests table');
    } catch (error) {
        // Column already exists, ignore
    }

    try {
        db.exec(`ALTER TABLE purchase_requests ADD COLUMN approval_count INTEGER DEFAULT 0`);
        console.log('Added approval_count column to purchase_requests table');
    } catch (error) {
        // Column already exists, ignore
    }

    // Add requested_arrival_date column if it doesn't exist (migration)
    try {
        db.exec(`ALTER TABLE purchase_requests ADD COLUMN requested_arrival_date TEXT`);
        console.log('Added requested_arrival_date column to purchase_requests table');
    } catch (error) {
        // Column already exists, ignore
    }

    // Add order_name column if it doesn't exist (migration)
    try {
        db.exec(`ALTER TABLE purchase_requests ADD COLUMN order_name TEXT`);
        console.log('Added order_name column to purchase_requests table');
    } catch (error) {
        // Column already exists, ignore
    }

    // Add slack_user_id to users table (migration)
    try {
        db.exec(`ALTER TABLE users ADD COLUMN slack_user_id TEXT`);
        console.log('Added slack_user_id column to users table');
    } catch (error) {
        // Column already exists, ignore
    }

    // Add slack notification templates to departments table (migration)
    try {
        db.exec(`ALTER TABLE departments ADD COLUMN slack_approval_message TEXT`);
        console.log('Added slack_approval_message column to departments table');
    } catch (error) {
        // Column already exists, ignore
    }

    // Add tracking_number column if it doesn't exist (migration)
    try {
        db.exec(`ALTER TABLE purchase_requests ADD COLUMN tracking_number TEXT`);
        console.log('Added tracking_number column to purchase_requests table');
    } catch (error) {
        // Column already exists, ignore
    }

    // Add estimated_delivery_date column if it doesn't exist (migration)
    try {
        db.exec(`ALTER TABLE purchase_requests ADD COLUMN estimated_delivery_date TEXT`);
        console.log('Added estimated_delivery_date column to purchase_requests table');
    } catch (error) {
        // Column already exists, ignore
    }

    // Add actual_amount_spent column if it doesn't exist (migration)
    try {
        db.exec(`ALTER TABLE purchase_requests ADD COLUMN actual_amount_spent REAL`);
        console.log('Added actual_amount_spent column to purchase_requests table');
    } catch (error) {
        // Column already exists, ignore
    }

    // Create approvals tracking table
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS purchase_request_approvals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                purchase_request_id INTEGER NOT NULL,
                approver_id INTEGER NOT NULL,
                approved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (approver_id) REFERENCES users(id),
                UNIQUE(purchase_request_id, approver_id)
            )
        `);
        console.log('Created purchase_request_approvals table');
    } catch (error) {
        // Table already exists, ignore
    }

    // Create settings table
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Created settings table');
    } catch (error) {
        // Table already exists, ignore
    }

    // Initialize default settings
    const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get();
    if (settingsCount.count === 0) {
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('multi_approval_threshold', '1000');
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('required_approvals', '5');
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('base_url', 'http://localhost:3000');
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('slack_webhook_url', '');
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('slack_new_request_message', 'New purchase request submitted: {{requester}} requested ${{total}} from {{vendor}} (Request #{{id}})');
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('slack_approved_message', 'Purchase request approved: Request #{{id}} for ${{total}} from {{vendor}} is ready to be ordered');
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('slack_ordered_message', 'Purchase order placed: Request #{{id}} for {{vendor}} - Estimated: ${{total}}, Actual: ${{actual_amount_spent}}. Tracking: {{tracking_number}}');
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('slack_arrived_message', 'Purchase order arrived: Request #{{id}} from {{vendor}} has been received and needs to be marked as complete');
        
        // Google Sheets settings
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('google_sheets_enabled', 'false');
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('google_apps_script_webhook', '');
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('google_sheets_auto_export', 'true');
        
        console.log('Default settings initialized');
    } else {
        // Add base_url if it doesn't exist (for existing databases)
        const baseUrlExists = db.prepare('SELECT COUNT(*) as count FROM settings WHERE key = ?').get('base_url');
        if (baseUrlExists.count === 0) {
            db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('base_url', 'http://localhost:3000');
            console.log('Base URL setting added');
        }
        
        // Add Slack settings if they don't exist (for existing databases)
        const slackWebhookExists = db.prepare('SELECT COUNT(*) as count FROM settings WHERE key = ?').get('slack_webhook_url');
        if (slackWebhookExists.count === 0) {
            db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('slack_webhook_url', '');
            db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('slack_new_request_message', 'New purchase request submitted: {{requester}} requested ${{total}} from {{vendor}} (Request #{{id}})');
            db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('slack_approved_message', 'Purchase request approved: Request #{{id}} for ${{total}} from {{vendor}} is ready to be ordered');
            db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('slack_ordered_message', 'Purchase order placed: Request #{{id}} for {{vendor}} - Estimated: ${{total}}, Actual: ${{actual_amount_spent}}. Tracking: {{tracking_number}}');
            db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('slack_arrived_message', 'Purchase order arrived: Request #{{id}} from {{vendor}} has been received and needs to be marked as complete');
            console.log('Slack notification settings added');
        } else {
            // Add ordered message if it doesn't exist (for databases that have slack settings but not ordered message)
            const slackOrderedExists = db.prepare('SELECT COUNT(*) as count FROM settings WHERE key = ?').get('slack_ordered_message');
            if (slackOrderedExists.count === 0) {
                db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('slack_ordered_message', 'Purchase order placed: Request #{{id}} for {{vendor}} - Estimated: ${{total}}, Actual: ${{actual_amount_spent}}. Tracking: {{tracking_number}}');
                console.log('Slack ordered message setting added');
            }
        }
        
        // Add Google Sheets settings if they don't exist (for existing databases)
        const googleSheetsEnabledExists = db.prepare('SELECT COUNT(*) as count FROM settings WHERE key = ?').get('google_sheets_enabled');
        if (googleSheetsEnabledExists.count === 0) {
            db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('google_sheets_enabled', 'false');
            db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('google_apps_script_webhook', '');
            db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('google_sheets_auto_export', 'true');
            console.log('Google Sheets settings added');
        }
    }

    // Create default admin user if no users exist
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        db.prepare('INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)')
            .run('admin', hashedPassword, 'admin', 'System Administrator');
        
        // Add sample users
        const approverPass = bcrypt.hashSync('approver123', 10);
        db.prepare('INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)')
            .run('approver', approverPass, 'approver', 'John Approver');
        
        const purchaserPass = bcrypt.hashSync('purchaser123', 10);
        db.prepare('INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)')
            .run('purchaser', purchaserPass, 'purchaser', 'Jane Purchaser');
        
        console.log('Default users created:');
        console.log('  Admin: admin / admin123');
        console.log('  Approver: approver / approver123');
        console.log('  Purchaser: purchaser / purchaser123');
    }
}

// Helper functions for settings
function getSetting(key, defaultValue) {
    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return result ? result.value : defaultValue;
}

function getMultiApprovalThreshold() {
    return parseFloat(getSetting('multi_approval_threshold', '1000'));
}

function getRequiredApprovals() {
    return parseInt(getSetting('required_approvals', '5'));
}

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Google Sheets integration via Apps Script webhook
async function exportToGoogleSheets(requestData) {
    try {
        const isEnabled = getSetting('google_sheets_enabled', 'false') === 'true';
        if (!isEnabled) {
            console.log('[Google Sheets] Export disabled, skipping');
            return { success: false, message: 'Google Sheets export is disabled' };
        }

        const webhookUrl = getSetting('google_apps_script_webhook', '');
        
        if (!webhookUrl) {
            console.log('[Google Sheets] Missing webhook URL, skipping export');
            return { success: false, message: 'Google Apps Script webhook URL not configured' };
        }

        // Prepare data payload
        const exportData = {
            orderId: requestData.id,
            exportDate: new Date().toISOString().split('T')[0],
            orderName: requestData.order_name || 'Unnamed Order',
            requester: requestData.requester_name || 'Unknown',
            vendor: requestData.vendor_name || 'Unknown Vendor',
            estimatedCost: requestData.total ? parseFloat(requestData.total).toFixed(2) : '0.00',
            actualCost: requestData.actual_amount_spent ? parseFloat(requestData.actual_amount_spent).toFixed(2) : 'N/A',
            trackingNumber: requestData.tracking_number || 'N/A',
            estimatedDelivery: requestData.estimated_delivery_date || 'N/A',
            requestedArrival: requestData.requested_arrival_date || 'N/A',
            status: requestData.status || 'unknown',
            timestamp: new Date().toISOString()
        };

        console.log(`[Google Sheets] Sending data to Apps Script webhook for order ${requestData.id}`);

        // Send POST request to Google Apps Script webhook
        const https = require('https');
        const url = require('url');
        
        return new Promise((resolve, reject) => {
            const parsedUrl = url.parse(webhookUrl);
            const postData = JSON.stringify(exportData);
            
            const options = {
                hostname: parsedUrl.hostname,
                port: 443,
                path: parsedUrl.path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const request = https.request(options, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    // Google Apps Script often returns 302 redirect, which is actually success
                    if (response.statusCode === 200 || response.statusCode === 302) {
                        console.log(`[Google Sheets] Successfully exported order ${requestData.id} to Google Sheets (status: ${response.statusCode})`);
                        resolve({ success: true, message: 'Order exported to Google Sheets successfully' });
                    } else {
                        console.error('[Google Sheets] Export failed with status:', response.statusCode, 'Response:', data);
                        resolve({ success: false, message: `Export failed with status: ${response.statusCode}` });
                    }
                });
            });

            request.on('error', (error) => {
                console.error('[Google Sheets] Export request failed:', error);
                resolve({ success: false, message: `Export failed: ${error.message}` });
            });

            request.write(postData);
            request.end();
        });

    } catch (error) {
        console.error('[Google Sheets] Export failed:', error);
        return { success: false, message: `Export failed: ${error.message}` };
    }
}

// Slack notification function
async function sendSlackNotification(messageType, requestData) {
    try {
        console.log(`[Slack] Attempting to send notification: ${messageType}`, requestData);
        const webhookUrl = getSetting('slack_webhook_url', '');
        
        // Don't send if webhook URL is not configured
        if (!webhookUrl || webhookUrl.trim() === '') {
            console.log('[Slack] Webhook URL not configured, skipping notification');
            return;
        }

        console.log(`[Slack] Webhook URL found: ${webhookUrl.substring(0, 50)}...`);

        let messageTemplate = '';
        switch (messageType) {
            case 'new_request':
                messageTemplate = getSetting('slack_new_request_message', 'New purchase request submitted: {{requester}} requested ${{total}} from {{vendor}} (Request #{{id}})');
                break;
            case 'approved':
                messageTemplate = getSetting('slack_approved_message', 'Purchase request approved: Request #{{id}} for ${{total}} from {{vendor}} is ready to be ordered');
                break;
            case 'ordered':
                messageTemplate = getSetting('slack_ordered_message', 'Purchase order placed: Request #{{id}} for {{vendor}} - Estimated: ${{total}}, Actual: ${{actual_amount_spent}}. Tracking: {{tracking_number}}');
                break;
            case 'arrived':
                messageTemplate = getSetting('slack_arrived_message', 'Purchase order arrived: Request #{{id}} from {{vendor}} has been received and needs to be marked as complete');
                break;
            default:
                console.log(`[Slack] Unknown message type: ${messageType}`);
                return;
        }

        // Replace placeholders with actual data
        // Generate direct link to the request
        const baseUrl = getSetting('base_url', 'http://localhost:3000');
        const requestLink = `${baseUrl}/tracking.html?id=${requestData.id}`;
        
        let message = messageTemplate
            .replace(/\{\{id\}\}/g, requestData.id || '')
            .replace(/\{\{requester\}\}/g, requestData.requester_name || '')
            .replace(/\{\{vendor\}\}/g, requestData.vendor_name || '')
            .replace(/\{\{total\}\}/g, requestData.total ? requestData.total.toFixed(2) : '0.00')
            .replace(/\{\{actual_amount_spent\}\}/g, requestData.actual_amount_spent ? requestData.actual_amount_spent.toFixed(2) : 'Not specified')
            .replace(/\{\{tracking_number\}\}/g, requestData.tracking_number || 'Not specified')
            .replace(/\{\{estimated_delivery_date\}\}/g, requestData.estimated_delivery_date ? formatDate(requestData.estimated_delivery_date) : 'Not specified')
            .replace(/\{\{requested_arrival_date\}\}/g, requestData.requested_arrival_date ? formatDate(requestData.requested_arrival_date) : 'Not specified')
            .replace(/\{\{order_name\}\}/g, requestData.order_name || 'Unnamed Order')
            .replace(/\{\{link\}\}/g, requestLink);

        console.log(`[Slack] Sending message: ${message}`);

        // Send to Slack using native https module
        const https = require('https');
        const url = new URL(webhookUrl);
        const postData = JSON.stringify({ text: message });

        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                console.error('[Slack] Failed to send notification, status:', res.statusCode);
            } else {
                console.log('[Slack] Notification sent successfully');
            }
        });

        req.on('error', (error) => {
            console.error('[Slack] Error sending notification:', error);
        });

        req.write(postData);
        req.end();
    } catch (error) {
        console.error('[Slack] Exception in sendSlackNotification:', error);
    }
}

// Send category-specific or multi-approval Slack notification
async function sendCategoryApprovalNotification(requestData, departmentInfo) {
    try {
        console.log(`[Slack] Attempting to send category approval notification`, requestData);
        const webhookUrl = getSetting('slack_webhook_url', '');
        
        // Don't send if webhook URL is not configured
        if (!webhookUrl || webhookUrl.trim() === '') {
            console.log('[Slack] Webhook URL not configured, skipping notification');
            return;
        }

        let messageTemplate = '';
        
        // Determine which template to use
        if (requestData.requires_multi_approval) {
            // Use multi-approval template
            messageTemplate = getSetting('slack_multi_approval_message', 
                'Multi-approval required: Request #{{id}} ({{order_name}}) for ${{total}} from {{vendor}} requires {{required_approvals}} approvals');
        } else if (departmentInfo && departmentInfo.slack_approval_message) {
            // Use category-specific template
            messageTemplate = departmentInfo.slack_approval_message;
        } else {
            // Fall back to default approved message
            messageTemplate = getSetting('slack_approved_message', 
                'Purchase request approved: Request #{{id}} for ${{total}} from {{vendor}} is ready to be ordered');
        }

        // Get approver's Slack user ID if available
        let approverMention = requestData.approver_name || 'Unknown';
        if (requestData.approver_slack_id) {
            approverMention = `<@${requestData.approver_slack_id}>`;
        }

        // Generate direct link to the request
        const baseUrl = getSetting('base_url', 'http://localhost:3000');
        const requestLink = `${baseUrl}/approval.html?id=${requestData.id}`;

        // Replace placeholders with actual data
        let message = messageTemplate
            .replace(/\{\{id\}\}/g, requestData.id || '')
            .replace(/\{\{requester\}\}/g, requestData.requester_name || '')
            .replace(/\{\{vendor\}\}/g, requestData.vendor_name || '')
            .replace(/\{\{total\}\}/g, requestData.total ? requestData.total.toFixed(2) : '0.00')
            .replace(/\{\{requested_arrival_date\}\}/g, requestData.requested_arrival_date ? formatDate(requestData.requested_arrival_date) : 'Not specified')
            .replace(/\{\{order_name\}\}/g, requestData.order_name || 'Unnamed Order')
            .replace(/\{\{category\}\}/g, departmentInfo ? departmentInfo.name : 'Unknown')
            .replace(/\{\{approver\}\}/g, approverMention)
            .replace(/\{\{required_approvals\}\}/g, requestData.required_approvals || getRequiredApprovals())
            .replace(/\{\{link\}\}/g, requestLink);

        console.log(`[Slack] Sending category approval message: ${message}`);

        // Send to Slack using native https module
        const https = require('https');
        const url = new URL(webhookUrl);
        const postData = JSON.stringify({ text: message });

        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                console.error('[Slack] Failed to send notification, status:', res.statusCode);
            } else {
                console.log('[Slack] Category approval notification sent successfully');
            }
        });

        req.on('error', (error) => {
            console.error('[Slack] Error sending notification:', error);
        });

        req.write(postData);
        req.end();
    } catch (error) {
        console.error('[Slack] Exception in sendCategoryApprovalNotification:', error);
    }
}

// Authentication middleware
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session.userId || !roles.includes(req.session.userRole)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
}

// API Routes

// Public endpoints (no authentication required)
app.get('/api/public/vendors', (req, res) => {
    const vendors = db.prepare('SELECT id, name, contact_person, email, phone FROM vendors ORDER BY name').all();
    res.json(vendors);
});

app.post('/api/public/vendors', (req, res) => {
    const { name, contact_person, email, phone } = req.body;
    
    if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Vendor name is required' });
    }
    
    try {
        const result = db.prepare(
            'INSERT INTO vendors (name, contact_person, email, phone) VALUES (?, ?, ?, ?)'
        ).run(name.trim(), contact_person || null, email || null, phone || null);
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'A vendor with this name already exists' });
        } else {
            console.error(error);
            res.status(400).json({ error: 'Failed to create vendor' });
        }
    }
});

app.get('/api/public/departments', (req, res) => {
    const departments = db.prepare('SELECT id, name FROM departments ORDER BY name').all();
    res.json(departments);
});

app.post('/api/public/departments', (req, res) => {
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Department name is required' });
    }
    
    try {
        const result = db.prepare('INSERT INTO departments (name) VALUES (?)').run(name.trim());
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'A department with this name already exists' });
        } else {
            console.error(error);
            res.status(400).json({ error: 'Failed to create department' });
        }
    }
});

app.post('/api/public/purchase-requests', (req, res) => {
    const { vendor_id, department_id, requester_name, order_name, items, tax_rate, shipping_cost, notes, requested_arrival_date } = req.body;
    
    if (!requester_name || requester_name.trim().length === 0) {
        return res.status(400).json({ error: 'Requester name is required' });
    }
    
    if (!department_id) {
        return res.status(400).json({ error: 'Department is required' });
    }
    
    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'At least one item is required' });
    }
    
    try {
        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const tax_amount = subtotal * (tax_rate / 100);
        const shipping = shipping_cost || 0;
        const total = subtotal + tax_amount + shipping;
        
        // Check if multi-approval is required (use dynamic threshold from settings)
        const threshold = getMultiApprovalThreshold();
        const requiresMultiApproval = total >= threshold ? 1 : 0;
        
        // Use a default "public" user ID (we'll create this user if it doesn't exist)
        let publicUser = db.prepare('SELECT id FROM users WHERE username = ?').get('public');
        if (!publicUser) {
            const hashedPassword = bcrypt.hashSync('public-no-login', 10);
            const result = db.prepare('INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)')
                .run('public', hashedPassword, 'purchaser', 'Public Request');
            publicUser = { id: result.lastInsertRowid };
        }
        
        // Insert purchase request
        const result = db.prepare(`
            INSERT INTO purchase_requests (vendor_id, department_id, requester_id, requester_name, order_name, subtotal, tax_amount, shipping_cost, total, notes, requires_multi_approval, approval_count, requested_arrival_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        `).run(vendor_id, department_id, publicUser.id, requester_name.trim(), order_name ? order_name.trim() : null, subtotal, tax_amount, shipping, total, notes, requiresMultiApproval, requested_arrival_date || null);
        
        const requestId = result.lastInsertRowid;
        
        // Insert items
        const insertItem = db.prepare(`
            INSERT INTO purchase_request_items (purchase_request_id, product_name, description, purchase_link, quantity, unit_price, line_total)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        items.forEach(item => {
            const line_total = item.quantity * item.unit_price;
            insertItem.run(requestId, item.product_name, item.description, item.purchase_link || null, item.quantity, item.unit_price, line_total);
        });
        
        // Get full request details for notification
        const requestDetails = db.prepare(`
            SELECT pr.*, v.name as vendor_name, d.name as department_name, 
                   u.full_name as approver_name, u.slack_user_id as approver_slack_id
            FROM purchase_requests pr
            JOIN vendors v ON pr.vendor_id = v.id
            JOIN departments d ON pr.department_id = d.id
            LEFT JOIN users u ON d.approver_id = u.id
            WHERE pr.id = ?
        `).get(requestId);
        
        // Get department info for the category-specific approval message
        const departmentInfo = db.prepare('SELECT id, name, slack_approval_message FROM departments WHERE id = ?').get(department_id);
        
        // Send category approval notification
        sendCategoryApprovalNotification(requestDetails, departmentInfo);
        
        res.json({ success: true, id: requestId });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to create purchase request' });
    }
});

// Authentication
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.userName = user.full_name;
    
    res.json({ 
        success: true, 
        user: { 
            id: user.id, 
            username: user.username, 
            role: user.role,
            fullName: user.full_name
        } 
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/auth/check', (req, res) => {
    if (req.session.userId) {
        res.json({ 
            authenticated: true, 
            userId: req.session.userId,
            role: req.session.userRole,
            fullName: req.session.userName
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Vendors
app.get('/api/vendors', requireAuth, (req, res) => {
    const vendors = db.prepare('SELECT * FROM vendors ORDER BY name').all();
    res.json({ vendors });
});

app.post('/api/vendors', requireAuth, requireRole('admin'), (req, res) => {
    const { name, contact_person, email, phone } = req.body;
    
    try {
        const result = db.prepare(
            'INSERT INTO vendors (name, contact_person, email, phone) VALUES (?, ?, ?, ?)'
        ).run(name, contact_person, email, phone);
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        res.status(400).json({ error: 'Failed to create vendor' });
    }
});

app.delete('/api/vendors/:id', requireAuth, requireRole('admin'), (req, res) => {
    try {
        db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: 'Failed to delete vendor' });
    }
});

// Departments
app.get('/api/departments', requireAuth, (req, res) => {
    const departments = db.prepare(`
        SELECT d.*, u.full_name as approver_name
        FROM departments d
        LEFT JOIN users u ON d.approver_id = u.id
        ORDER BY d.name
    `).all();
    res.json({ departments });
});

app.post('/api/departments', requireAuth, requireRole('admin'), (req, res) => {
    const { name, approver_id, slack_approval_message } = req.body;
    
    try {
        const result = db.prepare('INSERT INTO departments (name, approver_id, slack_approval_message) VALUES (?, ?, ?)').run(name, approver_id || null, slack_approval_message || null);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        res.status(400).json({ error: 'Failed to create department' });
    }
});

app.put('/api/departments/:id', requireAuth, requireRole('admin'), (req, res) => {
    const { name, approver_id, slack_approval_message } = req.body;
    
    try {
        db.prepare('UPDATE departments SET name = ?, approver_id = ?, slack_approval_message = ? WHERE id = ?').run(name, approver_id || null, slack_approval_message || null, req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: 'Failed to update department' });
    }
});

app.delete('/api/departments/:id', requireAuth, requireRole('admin'), (req, res) => {
    try {
        db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: 'Failed to delete department' });
    }
});

// Purchase Requests
app.get('/api/purchase-requests', requireAuth, (req, res) => {
    let query = `
        SELECT pr.*, 
               v.name as vendor_name,
               d.name as department_name,
               a.full_name as approver_name
        FROM purchase_requests pr
        JOIN vendors v ON pr.vendor_id = v.id
        LEFT JOIN departments d ON pr.department_id = d.id
        JOIN users u ON pr.requester_id = u.id
        LEFT JOIN users a ON pr.approved_by = a.id
    `;
    
    // Filter based on role
    if (req.session.userRole === 'purchaser') {
        query += ' WHERE pr.requester_id = ?';
        const requests = db.prepare(query + ' ORDER BY pr.created_at DESC').all(req.session.userId);
        return res.json(requests);
    }
    
    const requests = db.prepare(query + ' ORDER BY pr.created_at DESC').all();
    res.json(requests);
});

app.get('/api/purchase-requests/:id', requireAuth, (req, res) => {
    const request = db.prepare(`
        SELECT pr.*, 
               v.name as vendor_name, v.contact_person, v.email, v.phone,
               d.name as department_name,
               a.full_name as approver_name
        FROM purchase_requests pr
        JOIN vendors v ON pr.vendor_id = v.id
        LEFT JOIN departments d ON pr.department_id = d.id
        JOIN users u ON pr.requester_id = u.id
        LEFT JOIN users a ON pr.approved_by = a.id
        WHERE pr.id = ?
    `).get(req.params.id);
    
    if (!request) {
        return res.status(404).json({ error: 'Purchase request not found' });
    }
    
    const items = db.prepare(
        'SELECT * FROM purchase_request_items WHERE purchase_request_id = ?'
    ).all(req.params.id);
    
    res.json({ ...request, items });
});

app.post('/api/purchase-requests', requireAuth, (req, res) => {
    const { vendor_id, department_id, order_name, items, tax_rate, notes, requested_arrival_date } = req.body;
    
    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'At least one item is required' });
    }
    
    try {
        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const tax_amount = subtotal * (tax_rate / 100);
        const total = subtotal + tax_amount;
        
        // Get requester name from session
        const requesterName = req.session.userName || 'Unknown';
        
        // Insert purchase request
        const result = db.prepare(`
            INSERT INTO purchase_requests (vendor_id, department_id, requester_id, requester_name, order_name, subtotal, tax_amount, total, notes, requested_arrival_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(vendor_id, department_id, req.session.userId, requesterName, order_name ? order_name.trim() : null, subtotal, tax_amount, total, notes, requested_arrival_date || null);
        
        const requestId = result.lastInsertRowid;
        
        // Insert items
        const insertItem = db.prepare(`
            INSERT INTO purchase_request_items (purchase_request_id, product_name, description, purchase_link, quantity, unit_price, line_total)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        items.forEach(item => {
            const line_total = item.quantity * item.unit_price;
            insertItem.run(requestId, item.product_name, item.description, item.purchase_link || null, item.quantity, item.unit_price, line_total);
        });
        
        // Get full request details for notification
        const requestDetails = db.prepare(`
            SELECT pr.*, v.name as vendor_name, d.name as department_name, 
                   u.full_name as approver_name, u.slack_user_id as approver_slack_id
            FROM purchase_requests pr
            JOIN vendors v ON pr.vendor_id = v.id
            JOIN departments d ON pr.department_id = d.id
            LEFT JOIN users u ON d.approver_id = u.id
            WHERE pr.id = ?
        `).get(requestId);
        
        // Get department info for the category-specific approval message
        const departmentInfo = db.prepare('SELECT id, name, slack_approval_message FROM departments WHERE id = ?').get(department_id);
        
        // Send category approval notification
        sendCategoryApprovalNotification(requestDetails, departmentInfo);
        
        res.json({ success: true, id: requestId });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to create purchase request' });
    }
});

app.put('/api/purchase-requests/:id/status', requireAuth, requireRole('admin', 'approver'), (req, res) => {
    const { status } = req.body;
    const requestId = req.params.id;
    const isAdmin = req.session.userRole === 'admin';
    
    try {
        // Get the purchase request details
        const request = db.prepare(`
            SELECT pr.*, d.approver_id as category_approver
            FROM purchase_requests pr
            LEFT JOIN departments d ON pr.department_id = d.id
            WHERE pr.id = ?
        `).get(requestId);
        
        if (!request) {
            return res.status(404).json({ error: 'Purchase request not found' });
        }
        
        // Check if this approver is authorized for this category
        if (!isAdmin && request.category_approver && request.category_approver !== req.session.userId) {
            return res.status(403).json({ error: 'You are not authorized to approve purchases in this category' });
        }
        
        if (status === 'approved') {
            // Check if multi-approval is required
            if (request.requires_multi_approval && !isAdmin) {
                // Check if this user has already approved
                const existingApproval = db.prepare(`
                    SELECT id FROM purchase_request_approvals 
                    WHERE purchase_request_id = ? AND approver_id = ?
                `).get(requestId, req.session.userId);
                
                if (existingApproval) {
                    return res.status(400).json({ error: 'You have already approved this request' });
                }
                
                // Add this approval
                db.prepare(`
                    INSERT INTO purchase_request_approvals (purchase_request_id, approver_id)
                    VALUES (?, ?)
                `).run(requestId, req.session.userId);
                
                // Increment approval count
                const newCount = request.approval_count + 1;
                db.prepare(`
                    UPDATE purchase_requests 
                    SET approval_count = ?
                    WHERE id = ?
                `).run(newCount, requestId);
                
                // Check if we have enough approvals (use dynamic setting)
                const requiredApprovals = getRequiredApprovals();
                if (newCount >= requiredApprovals) {
                    db.prepare(`
                        UPDATE purchase_requests 
                        SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(req.session.userId, requestId);
                    
                    // Get full request details including approver info
                    const requestDetails = db.prepare(`
                        SELECT pr.*, v.name as vendor_name, d.name as department_name, 
                               u.full_name as approver_name, u.slack_user_id as approver_slack_id
                        FROM purchase_requests pr
                        JOIN vendors v ON pr.vendor_id = v.id
                        LEFT JOIN departments d ON pr.department_id = d.id
                        LEFT JOIN users u ON u.id = ?
                        WHERE pr.id = ?
                    `).get(req.session.userId, requestId);
                    
                    requestDetails.required_approvals = requiredApprovals;
                    
                    // Get department info for category-specific notification
                    const departmentInfo = requestDetails.department_id ? 
                        db.prepare('SELECT * FROM departments WHERE id = ?').get(requestDetails.department_id) : null;
                    
                    // Send category-specific approval notification
                    sendCategoryApprovalNotification(requestDetails, departmentInfo);
                    
                    return res.json({ success: true, message: `Request fully approved with ${newCount} approvals`, approved: true });
                } else {
                    return res.json({ success: true, message: `Approval recorded (${newCount}/${requiredApprovals})`, approved: false, approvalCount: newCount, required: requiredApprovals });
                }
            } else {
                // Admin can override or single approval is sufficient
                db.prepare(`
                    UPDATE purchase_requests 
                    SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(req.session.userId, requestId);
                
                // Get full request details including approver info
                const requestDetails = db.prepare(`
                    SELECT pr.*, v.name as vendor_name, d.name as department_name,
                           u.full_name as approver_name, u.slack_user_id as approver_slack_id
                    FROM purchase_requests pr
                    JOIN vendors v ON pr.vendor_id = v.id
                    LEFT JOIN departments d ON pr.department_id = d.id
                    LEFT JOIN users u ON u.id = ?
                    WHERE pr.id = ?
                `).get(req.session.userId, requestId);
                
                // Get department info for category-specific notification
                const departmentInfo = requestDetails.department_id ? 
                    db.prepare('SELECT * FROM departments WHERE id = ?').get(requestDetails.department_id) : null;
                
                // Send category-specific approval notification
                sendCategoryApprovalNotification(requestDetails, departmentInfo);
            }
        } else if (status === 'rejected') {
            db.prepare(`
                UPDATE purchase_requests 
                SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(req.session.userId, requestId);
        } else if (status === 'ordered') {
            // Mark as ordered with optional tracking number, estimated delivery date, and actual amount spent
            const { tracking_number, estimated_delivery_date, actual_amount_spent } = req.body;
            
            // Validate actual_amount_spent is provided and is a positive number
            if (!actual_amount_spent || actual_amount_spent <= 0) {
                return res.status(400).json({ error: 'Actual amount spent is required and must be greater than 0' });
            }
            
            const updateQuery = `
                UPDATE purchase_requests 
                SET status = ?, 
                    tracking_number = ?, 
                    estimated_delivery_date = ?,
                    actual_amount_spent = ?
                WHERE id = ?
            `;
            
            db.prepare(updateQuery).run(status, tracking_number || null, estimated_delivery_date || null, actual_amount_spent, requestId);
            
            // Get vendor name for notification
            const requestDetails = db.prepare(`
                SELECT pr.*, v.name as vendor_name
                FROM purchase_requests pr
                JOIN vendors v ON pr.vendor_id = v.id
                WHERE pr.id = ?
            `).get(requestId);
            
            // Send Slack notification for ordered request
            sendSlackNotification('ordered', requestDetails);
            
            // Export to Google Sheets if auto-export is enabled
            const autoExport = getSetting('google_sheets_auto_export', 'true') === 'true';
            if (autoExport) {
                exportToGoogleSheets(requestDetails).then(result => {
                    if (result.success) {
                        console.log(`[Google Sheets] Auto-export successful for order ${requestId}`);
                    } else {
                        console.log(`[Google Sheets] Auto-export failed for order ${requestId}: ${result.message}`);
                    }
                }).catch(error => {
                    console.error(`[Google Sheets] Auto-export error for order ${requestId}:`, error);
                });
            }
        } else {
            db.prepare('UPDATE purchase_requests SET status = ? WHERE id = ?')
                .run(status, requestId);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to update status' });
    }
});

// Update tracking information for an order
app.put('/api/purchase-requests/:id/tracking', requireAuth, requireRole('admin', 'approver', 'purchaser'), (req, res) => {
    const { tracking_number, estimated_delivery_date, actual_amount_spent } = req.body;
    const requestId = req.params.id;
    
    try {
        // Get the purchase request to ensure it exists
        const request = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(requestId);
        
        if (!request) {
            return res.status(404).json({ error: 'Purchase request not found' });
        }
        
        // Validate actual_amount_spent if provided
        if (actual_amount_spent !== undefined && actual_amount_spent !== null && actual_amount_spent <= 0) {
            return res.status(400).json({ error: 'Actual amount spent must be greater than 0' });
        }
        
        // Update tracking information
        const updateQuery = `
            UPDATE purchase_requests 
            SET tracking_number = ?, 
                estimated_delivery_date = ?,
                actual_amount_spent = ?
            WHERE id = ?
        `;
        
        db.prepare(updateQuery).run(
            tracking_number || null, 
            estimated_delivery_date || null,
            actual_amount_spent || null,
            requestId
        );
        
        res.json({ success: true, message: 'Tracking information updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to update tracking information' });
    }
});

app.put('/api/purchase-requests/:requestId/items/:itemId/receive', requireAuth, requireRole('admin', 'purchaser'), (req, res) => {
    const { requestId, itemId } = req.params;
    const { quantity_received } = req.body;
    
    try {
        // Update item
        db.prepare(`
            UPDATE purchase_request_items 
            SET quantity_received = quantity_received + ?, 
                received_at = CASE WHEN received_at IS NULL THEN CURRENT_TIMESTAMP ELSE received_at END
            WHERE id = ? AND purchase_request_id = ?
        `).run(quantity_received, itemId, requestId);
        
        // Check if all items are fully received
        const items = db.prepare(
            'SELECT * FROM purchase_request_items WHERE purchase_request_id = ?'
        ).all(requestId);
        
        // Get current status before update
        const currentRequest = db.prepare('SELECT status FROM purchase_requests WHERE id = ?').get(requestId);
        const wasOrdered = currentRequest.status === 'ordered';
        
        const allReceived = items.every(item => item.quantity_received >= item.quantity);
        const someReceived = items.some(item => item.quantity_received > 0);
        
        let newStatus = 'ordered';
        if (allReceived) {
            newStatus = 'completed';
        } else if (someReceived) {
            newStatus = 'partially_received';
        }
        
        db.prepare('UPDATE purchase_requests SET status = ? WHERE id = ?')
            .run(newStatus, requestId);
        
        // Send notification when first items arrive (transition from ordered to partially_received)
        if (wasOrdered && (newStatus === 'partially_received' || newStatus === 'completed')) {
            const requestDetails = db.prepare(`
                SELECT pr.*, v.name as vendor_name
                FROM purchase_requests pr
                JOIN vendors v ON pr.vendor_id = v.id
                WHERE pr.id = ?
            `).get(requestId);
            
            sendSlackNotification('arrived', requestDetails);
        }
        
        res.json({ success: true, newStatus });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to receive items' });
    }
});

// Users management (admin only)
app.get('/api/users', requireAuth, requireRole('admin'), (req, res) => {
    const users = db.prepare('SELECT id, username, role, full_name, slack_user_id, created_at FROM users').all();
    res.json({ users });
});

app.get('/api/approvers', requireAuth, requireRole('admin'), (req, res) => {
    const approvers = db.prepare('SELECT id, full_name FROM users WHERE role IN (?, ?) ORDER BY full_name').all('admin', 'approver');
    res.json({ approvers });
});

app.post('/api/users', requireAuth, requireRole('admin'), (req, res) => {
    const { username, password, role, full_name, slack_user_id } = req.body;
    
    if (!username || !password || !role || !full_name) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (!['admin', 'approver', 'purchaser'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }
    
    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const result = db.prepare(
            'INSERT INTO users (username, password, role, full_name, slack_user_id) VALUES (?, ?, ?, ?, ?)'
        ).run(username, hashedPassword, role, full_name, slack_user_id || null);
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Username already exists' });
        } else {
            res.status(400).json({ error: 'Failed to create user' });
        }
    }
});

app.put('/api/users/:id', requireAuth, requireRole('admin'), (req, res) => {
    const { role, full_name, slack_user_id, password } = req.body;
    
    console.log('[PUT /api/users/:id] Received data:', { role, full_name, slack_user_id, password: password ? '[PROVIDED]' : '[NOT PROVIDED]' });
    
    if (!role || !full_name) {
        return res.status(400).json({ error: 'Role and full name are required' });
    }
    
    if (!['admin', 'approver', 'purchaser'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }
    
    try {
        // Don't allow changing your own role
        if (parseInt(req.params.id) === req.session.userId) {
            const currentUser = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id);
            if (currentUser && currentUser.role !== role) {
                return res.status(400).json({ error: 'Cannot change your own role' });
            }
        }
        
        // Update user - with or without password change
        if (password && password.trim().length > 0) {
            const hashedPassword = bcrypt.hashSync(password, 10);
            console.log('[PUT /api/users/:id] Updating with password, slack_user_id:', slack_user_id || null);
            db.prepare(
                'UPDATE users SET password = ?, role = ?, full_name = ?, slack_user_id = ? WHERE id = ?'
            ).run(hashedPassword, role, full_name, slack_user_id || null, req.params.id);
        } else {
            console.log('[PUT /api/users/:id] Updating without password, slack_user_id:', slack_user_id || null);
            db.prepare(
                'UPDATE users SET role = ?, full_name = ?, slack_user_id = ? WHERE id = ?'
            ).run(role, full_name, slack_user_id || null, req.params.id);
        }
        
        console.log('[PUT /api/users/:id] User updated successfully');
        res.json({ success: true });
    } catch (error) {
        console.error('[PUT /api/users/:id] Error updating user:', error);
        res.status(400).json({ error: 'Failed to update user' });
    }
});

app.delete('/api/users/:id', requireAuth, requireRole('admin'), (req, res) => {
    try {
        // Don't allow deleting yourself
        if (parseInt(req.params.id) === req.session.userId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        
        db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: 'Failed to delete user' });
    }
});

// Google Sheets API endpoints
app.post('/api/google-sheets/export/:id', requireAuth, requireRole('admin', 'approver', 'purchaser'), async (req, res) => {
    try {
        const requestId = req.params.id;
        
        // Get the purchase request details
        const requestDetails = db.prepare(`
            SELECT pr.*, v.name as vendor_name
            FROM purchase_requests pr
            JOIN vendors v ON pr.vendor_id = v.id
            WHERE pr.id = ?
        `).get(requestId);
        
        if (!requestDetails) {
            return res.status(404).json({ error: 'Purchase request not found' });
        }
        
        const result = await exportToGoogleSheets(requestDetails);
        
        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (error) {
        console.error('Manual export error:', error);
        res.status(500).json({ error: 'Export failed' });
    }
});

app.post('/api/google-sheets/test', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        // Create test data for verification
        const testData = {
            id: 'TEST-' + Date.now(),
            order_name: 'Test Export from Purchasing Tracker',
            requester_name: 'Test User',
            vendor_name: 'Test Vendor',
            total: 99.99,
            actual_amount_spent: 105.50,
            tracking_number: 'TEST123456789',
            estimated_delivery_date: '2025-10-25',
            requested_arrival_date: '2025-10-20',
            status: 'ordered'
        };
        
        const result = await exportToGoogleSheets(testData);
        
        if (result.success) {
            res.json({ success: true, message: 'Test export successful! Check your Google Sheet for the test row.' });
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (error) {
        console.error('Test export error:', error);
        res.status(500).json({ error: 'Test export failed' });
    }
});

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/approval', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'approval.html'));
});

app.get('/tracking', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tracking.html'));
});

// Settings API
// Settings API
app.get('/api/settings', requireAuth, requireRole('admin', 'approver'), (req, res) => {
    try {
        const threshold = getMultiApprovalThreshold();
        const requiredApprovals = getRequiredApprovals();
        const baseUrl = getSetting('base_url', 'http://localhost:3000');
        const slackWebhookUrl = getSetting('slack_webhook_url', '');
        const slackNewRequestMessage = getSetting('slack_new_request_message', 'New purchase request submitted: {{requester}} requested ${{total}} from {{vendor}} (Request #{{id}})');
        const slackApprovedMessage = getSetting('slack_approved_message', 'Purchase request approved: Request #{{id}} for ${{total}} from {{vendor}} is ready to be ordered');
        const slackMultiApprovalMessage = getSetting('slack_multi_approval_message', 'Purchase request requires multiple approvals: Request #{{id}} for ${{total}} from {{vendor}} requires {{required_approvals}} approvals');
        const slackOrderedMessage = getSetting('slack_ordered_message', 'Purchase order placed: Request #{{id}} for {{vendor}} - Estimated: ${{total}}, Actual: ${{actual_amount_spent}}. Tracking: {{tracking_number}}');
        const slackArrivedMessage = getSetting('slack_arrived_message', 'Purchase order arrived: Request #{{id}} from {{vendor}} has been received and needs to be marked as complete');
        
        // Google Sheets settings
        const googleSheetsEnabled = getSetting('google_sheets_enabled', 'false') === 'true';
        const googleAppsScriptWebhook = getSetting('google_apps_script_webhook', '');
        const googleSheetsAutoExport = getSetting('google_sheets_auto_export', 'true') === 'true';
        
        console.log('[Settings API] Returning settings:', {
            multi_approval_threshold: threshold,
            required_approvals: requiredApprovals,
            base_url: baseUrl,
            slack_webhook_url: slackWebhookUrl ? 'configured' : 'empty',
            google_sheets_enabled: googleSheetsEnabled,
            google_apps_script_webhook: googleAppsScriptWebhook ? 'configured' : 'empty'
        });
        
        res.json({
            multi_approval_threshold: threshold,
            required_approvals: requiredApprovals,
            base_url: baseUrl,
            slack_webhook_url: slackWebhookUrl,
            slack_new_request_message: slackNewRequestMessage,
            slack_approved_message: slackApprovedMessage,
            slack_multi_approval_message: slackMultiApprovalMessage,
            slack_ordered_message: slackOrderedMessage,
            slack_arrived_message: slackArrivedMessage,
            google_sheets_enabled: googleSheetsEnabled,
            google_apps_script_webhook: googleAppsScriptWebhook,
            google_sheets_auto_export: googleSheetsAutoExport
        });
    } catch (error) {
        console.error('[Settings API] Error:', error);
        res.status(500).json({ error: 'Failed to retrieve settings' });
    }
});

app.put('/api/settings', requireAuth, requireRole('admin'), (req, res) => {
    try {
        const { 
            multi_approval_threshold, 
            required_approvals,
            base_url,
            slack_webhook_url,
            slack_new_request_message,
            slack_approved_message,
            slack_multi_approval_message,
            slack_ordered_message,
            slack_arrived_message,
            google_sheets_enabled,
            google_apps_script_webhook,
            google_sheets_auto_export
        } = req.body;
        
        // Validate inputs
        if (multi_approval_threshold !== undefined) {
            const threshold = parseFloat(multi_approval_threshold);
            if (isNaN(threshold) || threshold < 0) {
                return res.status(400).json({ error: 'Invalid threshold value' });
            }
            
            db.prepare(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
            ).run(threshold.toString(), 'multi_approval_threshold');
        }
        
        if (required_approvals !== undefined) {
            const approvals = parseInt(required_approvals);
            if (isNaN(approvals) || approvals < 1) {
                return res.status(400).json({ error: 'Invalid required approvals value' });
            }
            
            db.prepare(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
            ).run(approvals.toString(), 'required_approvals');
        }
        
        // Update base URL
        if (base_url !== undefined) {
            db.prepare(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
            ).run(base_url, 'base_url');
        }
        
        // Update Slack settings
        if (slack_webhook_url !== undefined) {
            db.prepare(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
            ).run(slack_webhook_url, 'slack_webhook_url');
        }
        
        if (slack_new_request_message !== undefined) {
            db.prepare(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
            ).run(slack_new_request_message, 'slack_new_request_message');
        }
        
        if (slack_approved_message !== undefined) {
            db.prepare(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
            ).run(slack_approved_message, 'slack_approved_message');
        }
        
        if (slack_multi_approval_message !== undefined) {
            db.prepare(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
            ).run(slack_multi_approval_message, 'slack_multi_approval_message');
        }
        
        if (slack_ordered_message !== undefined) {
            db.prepare(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
            ).run(slack_ordered_message, 'slack_ordered_message');
        }
        
        if (slack_arrived_message !== undefined) {
            db.prepare(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
            ).run(slack_arrived_message, 'slack_arrived_message');
        }
        
        // Update Google Sheets settings
        if (google_sheets_enabled !== undefined) {
            const enabled = google_sheets_enabled ? 'true' : 'false';
            db.prepare(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
            ).run(enabled, 'google_sheets_enabled');
        }
        
        if (google_apps_script_webhook !== undefined) {
            // Validate webhook URL format if provided
            if (google_apps_script_webhook && google_apps_script_webhook.trim() !== '') {
                try {
                    new URL(google_apps_script_webhook);
                } catch (error) {
                    return res.status(400).json({ error: 'Invalid webhook URL format' });
                }
            }
            db.prepare(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
            ).run(google_apps_script_webhook, 'google_apps_script_webhook');
        }
        
        if (google_sheets_auto_export !== undefined) {
            const autoExport = google_sheets_auto_export ? 'true' : 'false';
            db.prepare(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
            ).run(autoExport, 'google_sheets_auto_export');
        }
        
        // Return updated values
        const threshold = getMultiApprovalThreshold();
        const requiredApprovalCount = getRequiredApprovals();
        
        res.json({
            success: true,
            multi_approval_threshold: threshold,
            required_approvals: requiredApprovalCount,
            base_url: getSetting('base_url', ''),
            slack_webhook_url: getSetting('slack_webhook_url', ''),
            slack_new_request_message: getSetting('slack_new_request_message', ''),
            slack_approved_message: getSetting('slack_approved_message', ''),
            slack_multi_approval_message: getSetting('slack_multi_approval_message', ''),
            slack_ordered_message: getSetting('slack_ordered_message', ''),
            slack_arrived_message: getSetting('slack_arrived_message', ''),
            google_sheets_enabled: getSetting('google_sheets_enabled', 'false') === 'true',
            google_apps_script_webhook: getSetting('google_apps_script_webhook', ''),
            google_sheets_auto_export: getSetting('google_sheets_auto_export', 'true') === 'true'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Test Slack webhook
app.post('/api/settings/test-slack', requireAuth, requireRole('admin'), async (req, res) => {
    const { webhook_url } = req.body;
    
    if (!webhook_url || webhook_url.trim() === '') {
        return res.status(400).json({ error: 'Webhook URL is required' });
    }
    
    try {
        const https = require('https');
        const url = new URL(webhook_url);
        const testMessage = '🧪 Test notification from Purchasing Tracker! Your Slack integration is working correctly.';
        const postData = JSON.stringify({ text: testMessage });

        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        return new Promise((resolve, reject) => {
            const request = https.request(options, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    if (response.statusCode === 200) {
                        res.json({ success: true, message: 'Test message sent successfully' });
                    } else {
                        res.status(400).json({ 
                            error: `Slack returned status ${response.statusCode}. Please check your webhook URL.` 
                        });
                    }
                    resolve();
                });
            });

            request.on('error', (error) => {
                console.error('Error sending test Slack notification:', error);
                res.status(500).json({ 
                    error: 'Failed to send test message. Please check your webhook URL.' 
                });
                reject(error);
            });

            request.write(postData);
            request.end();
        });
    } catch (error) {
        console.error('Error testing Slack webhook:', error);
        res.status(500).json({ error: 'Invalid webhook URL format' });
    }
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Initialize database and start server
initializeDatabase();

app.listen(PORT, () => {
    console.log(`\n=================================`);
    console.log(`Purchasing Tracker Server Running`);
    console.log(`=================================`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`\nDefault Login Credentials:`);
    console.log(`  Admin:     admin / admin123`);
    console.log(`  Approver:  approver / approver123`);
    console.log(`  Purchaser: purchaser / purchaser123`);
    console.log(`=================================\n`);
});
