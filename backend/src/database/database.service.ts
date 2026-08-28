import {Injectable, OnModuleInit} from '@nestjs/common';
import Database from 'better-sqlite3';
import * as bcrypt from 'bcryptjs';
import {join} from 'node:path';

@Injectable()
export class DatabaseService implements OnModuleInit {
  readonly db: Database.Database = new Database(
    process.env.DATABASE_PATH || join(process.cwd(), 'purchasing.db')
  );

  onModuleInit() {
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','approver','purchaser')), full_name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, slack_user_id TEXT, oidc_subject TEXT);
      CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, approver_id INTEGER, slack_approval_message TEXT);
      CREATE TABLE IF NOT EXISTS vendors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, contact_person TEXT, email TEXT, phone TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS funding_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, description TEXT, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS purchase_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, vendor_id INTEGER NOT NULL, department_id INTEGER, requester_id INTEGER NOT NULL, requester_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', subtotal REAL NOT NULL, tax_amount REAL NOT NULL, shipping_cost REAL DEFAULT 0, tariff_cost REAL DEFAULT 0, total REAL NOT NULL, notes TEXT, approved_by INTEGER, approved_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, requires_multi_approval INTEGER DEFAULT 0, approval_count INTEGER DEFAULT 0, requested_arrival_date TEXT, order_name TEXT, tracking_number TEXT, estimated_delivery_date TEXT, actual_amount_spent REAL, funding_source_id INTEGER);
      CREATE TABLE IF NOT EXISTS purchase_request_items (id INTEGER PRIMARY KEY AUTOINCREMENT, purchase_request_id INTEGER NOT NULL, product_name TEXT NOT NULL, description TEXT, purchase_link TEXT, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, line_total REAL NOT NULL, quantity_received INTEGER DEFAULT 0, received_at DATETIME);
      CREATE TABLE IF NOT EXISTS purchase_request_approvals (id INTEGER PRIMARY KEY AUTOINCREMENT, purchase_request_id INTEGER NOT NULL, approver_id INTEGER NOT NULL, approved_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(purchase_request_id, approver_id));
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    `);
    // Pre-existing databases won't have this column from CREATE TABLE IF NOT EXISTS.
    try {
      this.db.exec('ALTER TABLE users ADD COLUMN oidc_subject TEXT');
    } catch {
      // column already exists
    }
    this.db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oidc_subject ON users(oidc_subject) WHERE oidc_subject IS NOT NULL'
    );
    const defaults: Record<string, string> = {
      multi_approval_threshold: '1000',
      required_approvals: '5',
      base_url: 'http://localhost:3000',
      slack_webhook_url: '',
      slack_new_request_message:
        'New purchase request submitted: {{requester}} requested ${{total}} from {{vendor}} (Request #{{id}})',
      slack_approved_message:
        'Purchase request approved: Request #{{id}} for ${{total}} from {{vendor}} is ready to be ordered',
      slack_multi_approval_message:
        'Multi-approval required: Request #{{id}} ({{order_name}}) for ${{total}} from {{vendor}} requires {{required_approvals}} approvals',
      slack_ordered_message:
        'Purchase order placed: Request #{{id}} for {{vendor}} - Estimated: ${{total}}, Actual: ${{actual_amount_spent}}. Tracking: {{tracking_number}}',
      slack_arrived_message:
        'Purchase order arrived: Request #{{id}} from {{vendor}} has been received and needs to be marked as complete',
      google_sheets_enabled: 'false',
      google_apps_script_webhook: '',
      google_sheets_auto_export: 'true'
    };
    const set = this.db.prepare(
      'INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)'
    );
    for (const [key, value] of Object.entries(defaults)) set.run(key, value);
    if (
      (
        this.db.prepare('SELECT COUNT(*) count FROM users').get() as {
          count: number;
        }
      ).count === 0
    ) {
      const add = this.db.prepare(
        'INSERT INTO users (username,password,role,full_name) VALUES (?,?,?,?)'
      );
      add.run(
        'admin',
        bcrypt.hashSync('admin123', 10),
        'admin',
        'System Administrator'
      );
      add.run(
        'approver',
        bcrypt.hashSync('approver123', 10),
        'approver',
        'John Approver'
      );
      add.run(
        'purchaser',
        bcrypt.hashSync('purchaser123', 10),
        'purchaser',
        'Jane Purchaser'
      );
    }
    if (
      (
        this.db.prepare('SELECT COUNT(*) count FROM vendors').get() as {
          count: number;
        }
      ).count === 0
    ) {
      const add = this.db.prepare('INSERT INTO vendors(name) VALUES (?)');
      [
        'Office Supplies Inc',
        'Tech Solutions Ltd',
        'Industrial Equipment Co'
      ].forEach(name => add.run(name));
    }
    if (
      (
        this.db.prepare('SELECT COUNT(*) count FROM departments').get() as {
          count: number;
        }
      ).count === 0
    ) {
      const add = this.db.prepare('INSERT INTO departments(name) VALUES (?)');
      ['General', 'Technology', 'Office Supplies'].forEach(name =>
        add.run(name)
      );
    }
    if (
      (
        this.db.prepare('SELECT COUNT(*) count FROM funding_sources').get() as {
          count: number;
        }
      ).count === 0
    ) {
      const add = this.db.prepare(
        'INSERT INTO funding_sources(name,description) VALUES (?,?)'
      );
      add.run('FIRSTWA Account', 'FIRST Washington robotics team account');
      add.run('Hack Club Account', 'Hack Club funding account');
      add.run('General Fund', 'General purpose funding');
    }
  }

  setting(key: string, fallback = '') {
    return (
      (
        this.db.prepare('SELECT value FROM settings WHERE key=?').get(key) as
          {value: string} | undefined
      )?.value ?? fallback
    );
  }

  setSetting(key: string, value: string) {
    this.db
      .prepare(
        'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP'
      )
      .run(key, value);
  }
}
