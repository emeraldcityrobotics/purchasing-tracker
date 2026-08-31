import {Injectable,
  NotFoundException,
  BadRequestException} from '@nestjs/common';
import {Request} from 'express';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {DatabaseService} from '../database/database.service';

export interface UploadedReceiptFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const RECEIPT_MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf'
};
const receiptsDir
  = process.env.RECEIPTS_DIR || join(process.cwd(), 'uploads', 'receipts');
mkdirSync(receiptsDir, {recursive: true});

@Injectable()
export class PurchaseRequestsService {
  constructor(private readonly database: DatabaseService) {}
  list(request: Request) {
    let query = `SELECT pr.*,v.name vendor_name,d.name department_name,a.full_name approver_name,fs.name funding_source_name,COALESCE(item_totals.total_item_quantity,0) total_item_quantity,COALESCE(item_totals.received_item_quantity,0) received_item_quantity,(SELECT GROUP_CONCAT(u.full_name || ' - ' || pra.approved_at, char(10)) FROM purchase_request_approvals pra JOIN users u ON pra.approver_id=u.id WHERE pra.purchase_request_id=pr.id) approval_history FROM purchase_requests pr JOIN vendors v ON pr.vendor_id=v.id LEFT JOIN departments d ON pr.department_id=d.id LEFT JOIN users a ON pr.approved_by=a.id LEFT JOIN funding_sources fs ON pr.funding_source_id=fs.id LEFT JOIN (SELECT purchase_request_id,SUM(quantity) total_item_quantity,SUM(quantity_received) received_item_quantity FROM purchase_request_items GROUP BY purchase_request_id) item_totals ON item_totals.purchase_request_id=pr.id`;
    const params: any[] = [];
    if (request.session.userRole === 'purchaser') {
      query += ' WHERE pr.requester_id=?';
      params.push(request.session.userId);
    }
    return this.database.db
      .prepare(query + ' ORDER BY pr.created_at DESC')
      .all(...params);
  }

  detail(id: string) {
    const request = this.database.db
      .prepare(
        `SELECT pr.*,v.name vendor_name,v.contact_person,v.email,v.phone,d.name department_name,a.full_name approver_name,fs.name funding_source_name FROM purchase_requests pr JOIN vendors v ON pr.vendor_id=v.id LEFT JOIN departments d ON pr.department_id=d.id LEFT JOIN users a ON pr.approved_by=a.id LEFT JOIN funding_sources fs ON pr.funding_source_id=fs.id WHERE pr.id=?`
      )
      .get(id) as any;
    if (!request) throw new NotFoundException('Purchase request not found');
    const items = this.database.db
      .prepare(
        'SELECT * FROM purchase_request_items WHERE purchase_request_id=?'
      )
      .all(id);
    const approvers = this.database.db
      .prepare(
        'SELECT u.full_name approver_name,pra.approved_at FROM purchase_request_approvals pra JOIN users u ON pra.approver_id=u.id WHERE pra.purchase_request_id=? ORDER BY pra.approved_at'
      )
      .all(id);
    return {...request, items, approvers};
  }

  create(body: any, requesterId: number, requesterName: string) {
    if (!body.items?.length)
      throw new BadRequestException('At least one item is required');
    const subtotal = body.items.reduce(
      (sum: any, item: any) =>
        sum + Number(item.quantity) * Number(item.unit_price),
      0
    );
    const taxAmount = subtotal * (Number(body.tax_rate || 0) / 100);
    const shipping = Number(body.shipping_cost || 0);
    const tariff = Number(body.tariff_cost || 0);
    const total = subtotal + taxAmount + shipping + tariff;
    const threshold = Number(
      this.database.setting('multi_approval_threshold', '1000')
    );
    const result = this.database.db
      .prepare(
        `INSERT INTO purchase_requests(vendor_id,department_id,requester_id,requester_name,order_name,subtotal,tax_amount,shipping_cost,tariff_cost,total,notes,requires_multi_approval,requested_arrival_date) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        body.vendor_id,
        body.department_id,
        requesterId,
        requesterName,
        body.order_name || null,
        subtotal,
        taxAmount,
        shipping,
        tariff,
        total,
        body.notes || null,
        total >= threshold ? 1 : 0,
        body.requested_arrival_date || null
      );
    const add = this.database.db.prepare(
      'INSERT INTO purchase_request_items(purchase_request_id,product_name,description,purchase_link,quantity,unit_price,line_total) VALUES(?,?,?,?,?,?,?)'
    );
    for (const item of body.items)
      add.run(
        result.lastInsertRowid,
        item.product_name,
        item.description || null,
        item.purchase_link || null,
        item.quantity,
        item.unit_price,
        Number(item.quantity) * Number(item.unit_price)
      );
    return {success: true, id: result.lastInsertRowid};
  }

  updateStatus(id: string, status: string, body: any, userId: number) {
    const request = this.database.db
      .prepare('SELECT * FROM purchase_requests WHERE id=?')
      .get(id) as any;
    if (!request) throw new NotFoundException('Purchase request not found');
    if (status === 'approved' && request.requires_multi_approval) {
      try {
        this.database.db
          .prepare(
            'INSERT INTO purchase_request_approvals(purchase_request_id,approver_id) VALUES(?,?)'
          )
          .run(id, userId);
      } catch {
        throw new BadRequestException('You have already approved this request');
      }
      const count = (
        this.database.db
          .prepare(
            'SELECT COUNT(*) count FROM purchase_request_approvals WHERE purchase_request_id=?'
          )
          .get(id) as any
      ).count;
      const required = Number(this.database.setting('required_approvals', '5'));
      this.database.db
        .prepare(
          'UPDATE purchase_requests SET approval_count=?,status=? WHERE id=?'
        )
        .run(count, count >= required ? 'approved' : 'pending', id);
      return {
        success: true,
        approved: count >= required,
        approvalCount: count,
        required,
        message:
          count >= required
            ? 'Request fully approved'
            : `Approval recorded (${count}/${required})`
      };
    }
    if (status === 'ordered') {
      if (!Number(body.actual_amount_spent) || !body.funding_source_id)
        throw new BadRequestException(
          'Actual amount spent and funding source are required'
        );
      const tax = Number(body.tax_amount ?? request.tax_amount);
      const shipping = Number(body.shipping_cost ?? request.shipping_cost ?? 0);
      const tariff = Number(body.tariff_cost ?? request.tariff_cost ?? 0);
      if (tax < 0 || shipping < 0 || tariff < 0)
        throw new BadRequestException('Costs cannot be negative');
      this.database.db
        .prepare(
          'UPDATE purchase_requests SET status=?,tracking_number=?,estimated_delivery_date=?,actual_amount_spent=?,funding_source_id=?,tax_amount=?,shipping_cost=?,tariff_cost=?,total=? WHERE id=?'
        )
        .run(
          status,
          body.tracking_number || null,
          body.estimated_delivery_date || null,
          body.actual_amount_spent,
          body.funding_source_id,
          tax,
          shipping,
          tariff,
          request.subtotal + tax + shipping + tariff,
          id
        );
    } else
      this.database.db
        .prepare(
          'UPDATE purchase_requests SET status=?,approved_by=?,approved_at=CASE WHEN ? IN (\'approved\',\'rejected\') THEN CURRENT_TIMESTAMP ELSE approved_at END WHERE id=?'
        )
        .run(
          status,
          status === 'approved' || status === 'rejected' ? userId : null,
          status,
          id
        );
    return {success: true};
  }

  markOrdered(id: string, body: any) {
    const request = this.database.db
      .prepare('SELECT status FROM purchase_requests WHERE id=?')
      .get(id) as {status: string} | undefined;
    if (!request) throw new NotFoundException('Purchase request not found');
    if (request.status !== 'approved')
      throw new BadRequestException('Only approved requests can be marked as ordered');
    this.updateStatus(id, 'ordered', body, 0);
    return {success: true};
  }

  cancelOrder(id: string) {
    const request = this.database.db
      .prepare('SELECT status FROM purchase_requests WHERE id=?')
      .get(id) as {status: string} | undefined;
    if (!request) throw new NotFoundException('Purchase request not found');
    if (request.status !== 'approved')
      throw new BadRequestException('Only approved requests can be cancelled');
    this.database.db
      .prepare('UPDATE purchase_requests SET status=\'rejected\' WHERE id=?')
      .run(id);
    return {success: true};
  }

  receive(id: string, itemId: string, quantity: number) {
    if (!quantity || quantity < 1)
      throw new BadRequestException('Quantity must be positive');
    const request = this.database.db
      .prepare('SELECT status FROM purchase_requests WHERE id=?')
      .get(id) as {status: string} | undefined;
    if (!request) throw new NotFoundException('Purchase request not found');
    if (!['ordered', 'partially_received'].includes(request.status))
      throw new BadRequestException('Only ordered requests can receive items');
    const item = this.database.db
      .prepare(
        'SELECT quantity,quantity_received FROM purchase_request_items WHERE id=? AND purchase_request_id=?'
      )
      .get(itemId, id) as {quantity: number; quantity_received: number} | undefined;
    if (!item) throw new NotFoundException('Purchase request item not found');
    if (quantity > item.quantity - item.quantity_received)
      throw new BadRequestException('Quantity exceeds the remaining item quantity');
    this.database.db
      .prepare(
        'UPDATE purchase_request_items SET quantity_received=quantity_received+?,received_at=COALESCE(received_at,CURRENT_TIMESTAMP) WHERE id=? AND purchase_request_id=?'
      )
      .run(quantity, itemId, id);
    const items = this.database.db
      .prepare(
        'SELECT quantity,quantity_received FROM purchase_request_items WHERE purchase_request_id=?'
      )
      .all(id) as any[];
    const status = items.every(
      item => item.quantity_received >= item.quantity
    )
      ? 'completed'
      : items.some(item => item.quantity_received > 0)
        ? 'partially_received'
        : 'ordered';
    this.database.db
      .prepare('UPDATE purchase_requests SET status=? WHERE id=?')
      .run(status, id);
    return {success: true, newStatus: status};
  }

  updateTracking(id: string, body: any) {
    const request = this.database.db
      .prepare('SELECT status,subtotal,tax_amount FROM purchase_requests WHERE id=?')
      .get(id) as {status: string; subtotal: number; tax_amount: number} | undefined;
    if (!request) throw new NotFoundException('Purchase request not found');
    if (!['ordered', 'partially_received'].includes(request.status))
      throw new BadRequestException('Only ordered requests can update order details');
    const tax = Number(body.tax_amount ?? request.tax_amount);
    const shipping = Number(body.shipping_cost || 0);
    const tariff = Number(body.tariff_cost || 0);
    if (tax < 0 || shipping < 0 || tariff < 0)
      throw new BadRequestException('Costs cannot be negative');
    this.database.db
      .prepare(
        'UPDATE purchase_requests SET tracking_number=?,estimated_delivery_date=?,actual_amount_spent=?,funding_source_id=?,tax_amount=?,shipping_cost=?,tariff_cost=?,total=? WHERE id=?'
      )
      .run(
        body.tracking_number || null,
        body.estimated_delivery_date || null,
        body.actual_amount_spent || null,
        body.funding_source_id || null,
        tax,
        shipping,
        tariff,
        request.subtotal + tax + shipping + tariff,
        id
      );
    return {
      success: true,
      message: 'Tracking information updated successfully'
    };
  }

  saveReceipt(id: string, file: UploadedReceiptFile | undefined) {
    if (!file) throw new BadRequestException('Receipt file is required');
    if (file.size > RECEIPT_MAX_BYTES)
      throw new BadRequestException('Receipt file is too large');
    const extension = RECEIPT_MIME_EXTENSIONS[file.mimetype];
    if (!extension)
      throw new BadRequestException(
        'Receipt must be an image (PNG, JPEG, WEBP, GIF) or PDF'
      );
    const request = this.database.db
      .prepare('SELECT id FROM purchase_requests WHERE id=?')
      .get(id);
    if (!request) throw new NotFoundException('Purchase request not found');
    const filename = `${id}-${Date.now()}${extension}`;
    writeFileSync(join(receiptsDir, filename), file.buffer);
    this.database.db
      .prepare('UPDATE purchase_requests SET receipt_filename=? WHERE id=?')
      .run(filename, id);
    return {success: true, filename};
  }

  receiptPath(id: string): string | undefined {
    const request = this.database.db
      .prepare('SELECT receipt_filename FROM purchase_requests WHERE id=?')
      .get(id) as {receipt_filename: string | null} | undefined;
    if (!request?.receipt_filename) return undefined;
    return join(receiptsDir, request.receipt_filename);
  }
}
