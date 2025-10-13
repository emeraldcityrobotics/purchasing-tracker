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
        console.log('Default settings initialized');
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
    const { vendor_id, department_id, requester_name, items, tax_rate, shipping_cost, notes } = req.body;
    
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
            INSERT INTO purchase_requests (vendor_id, department_id, requester_id, requester_name, subtotal, tax_amount, shipping_cost, total, notes, requires_multi_approval, approval_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(vendor_id, department_id, publicUser.id, requester_name.trim(), subtotal, tax_amount, shipping, total, notes, requiresMultiApproval);
        
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
    const { name, approver_id } = req.body;
    
    try {
        const result = db.prepare('INSERT INTO departments (name, approver_id) VALUES (?, ?)').run(name, approver_id || null);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        res.status(400).json({ error: 'Failed to create department' });
    }
});

app.put('/api/departments/:id', requireAuth, requireRole('admin'), (req, res) => {
    const { name, approver_id } = req.body;
    
    try {
        db.prepare('UPDATE departments SET name = ?, approver_id = ? WHERE id = ?').run(name, approver_id || null, req.params.id);
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
    const { vendor_id, department_id, items, tax_rate, notes } = req.body;
    
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
            INSERT INTO purchase_requests (vendor_id, department_id, requester_id, requester_name, subtotal, tax_amount, total, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(vendor_id, department_id, req.session.userId, requesterName, subtotal, tax_amount, total, notes);
        
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
            }
        } else if (status === 'rejected') {
            db.prepare(`
                UPDATE purchase_requests 
                SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(req.session.userId, requestId);
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
        
        res.json({ success: true, newStatus });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to receive items' });
    }
});

// Users management (admin only)
app.get('/api/users', requireAuth, requireRole('admin'), (req, res) => {
    const users = db.prepare('SELECT id, username, role, full_name, created_at FROM users').all();
    res.json({ users });
});

app.get('/api/approvers', requireAuth, requireRole('admin'), (req, res) => {
    const approvers = db.prepare('SELECT id, full_name FROM users WHERE role IN (?, ?) ORDER BY full_name').all('admin', 'approver');
    res.json({ approvers });
});

app.post('/api/users', requireAuth, requireRole('admin'), (req, res) => {
    const { username, password, role, full_name } = req.body;
    
    if (!username || !password || !role || !full_name) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (!['admin', 'approver', 'purchaser'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }
    
    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const result = db.prepare(
            'INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)'
        ).run(username, hashedPassword, role, full_name);
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Username already exists' });
        } else {
            res.status(400).json({ error: 'Failed to create user' });
        }
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
app.get('/api/settings', requireAuth, requireRole(['admin', 'approver']), (req, res) => {
    try {
        const threshold = getMultiApprovalThreshold();
        const requiredApprovals = getRequiredApprovals();
        
        res.json({
            multi_approval_threshold: threshold,
            required_approvals: requiredApprovals
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve settings' });
    }
});

app.put('/api/settings', requireAuth, requireRole('admin'), (req, res) => {
    try {
        const { multi_approval_threshold, required_approvals } = req.body;
        
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
        
        // Return updated values
        const threshold = getMultiApprovalThreshold();
        const requiredApprovalCount = getRequiredApprovals();
        
        res.json({
            success: true,
            multi_approval_threshold: threshold,
            required_approvals: requiredApprovalCount
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
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
