import {Injectable,
  NotFoundException,
  BadRequestException} from '@nestjs/common';
import {Request} from 'express';
import {DatabaseService} from '../database/database.service';

@Injectable()
export class PurchaseRequestsService {
  constructor(private readonly database: DatabaseService) {}
  list(request: Request) {
    let query = `SELECT pr.*,v.name vendor_name,d.name department_name,a.full_name approver_name,fs.name funding_source_name FROM purchase_requests pr JOIN vendors v ON pr.vendor_id=v.id LEFT JOIN departments d ON pr.department_id=d.id LEFT JOIN users a ON pr.approved_by=a.id LEFT JOIN funding_sources fs ON pr.funding_source_id=fs.id`;
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
      this.database.db
        .prepare(
          'UPDATE purchase_requests SET status=?,tracking_number=?,estimated_delivery_date=?,actual_amount_spent=?,funding_source_id=? WHERE id=?'
        )
        .run(
          status,
          body.tracking_number || null,
          body.estimated_delivery_date || null,
          body.actual_amount_spent,
          body.funding_source_id,
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

  receive(id: string, itemId: string, quantity: number) {
    if (!quantity || quantity < 1)
      throw new BadRequestException('Quantity must be positive');
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
    this.detail(id);
    this.database.db
      .prepare(
        'UPDATE purchase_requests SET tracking_number=?,estimated_delivery_date=?,actual_amount_spent=? WHERE id=?'
      )
      .run(
        body.tracking_number || null,
        body.estimated_delivery_date || null,
        body.actual_amount_spent || null,
        id
      );
    return {
      success: true,
      message: 'Tracking information updated successfully'
    };
  }
}
