import {CommonModule, CurrencyPipe, DatePipe} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatChipsModule} from '@angular/material/chips';
import {MatDialog} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSelectModule} from '@angular/material/select';
import {MatTableModule} from '@angular/material/table';
import {MatTooltipModule} from '@angular/material/tooltip';
import {ApiService} from '../../core/api.service';
import {AuthService} from '../../core/auth.service';
import {NotificationService} from '../../core/notification.service';
import {PurchaseRequest, RequestStatus} from '../../core/models';
import {RequestService} from '../../core/request.service';
import {CancelOrderDialogComponent} from './cancel-order-dialog.component';
import {OrderDetailsDialogComponent, OrderDetailsDialogResult} from './order-details-dialog.component';
import {ReceiveItemDialogResult, ReceiveItemsDialogComponent} from './receive-items-dialog.component';

@Component({
  selector: 'app-tracking',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule
  ],
  templateUrl: './tracking.component.html',
  styleUrl: './tracking.component.scss'
})
export class TrackingComponent {
  private readonly api = inject(ApiService); readonly auth = inject(AuthService); private readonly dialog = inject(MatDialog); private readonly notifications = inject(NotificationService); readonly requestService = inject(RequestService); readonly requests = signal<PurchaseRequest[]>([]); readonly filter = signal<'all' | 'incomplete' | RequestStatus>('incomplete'); readonly search = signal(''); readonly loading = signal(true);
  readonly columns = ['order', 'estimated', 'actual', 'status', 'progress', 'actions'];
  constructor() {
    this.load();
  }

  load() {
    this.api.requests().subscribe({next: (requests) => {
      this.requests.set(requests); this.loading.set(false);
    }, error: () => this.loading.set(false)});
  }

  visible() {
    const filter = this.filter(); const query = this.search().trim().toLowerCase(); return this.requests().filter(request => {
      const matchesStatus = filter === 'all' || (filter === 'incomplete' ? !['completed', 'rejected'].includes(request.status) : request.status === filter);
      const matchesSearch = !query || [request.id, request.order_name, request.vendor_name, request.department_name, request.requester_name].some(value => value?.toString().toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }

  approvalTooltip(request: PurchaseRequest) {
    if (request.approval_history)
      return request.approval_history.replace(/ - (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/g, (_, timestamp: string) => ` - ${this.relativeTime(timestamp)}`);
    if (request.approver_name && request.approved_at)
      return `Approved by ${request.approver_name} - ${this.relativeTime(request.approved_at)}`;
    return 'Approval details unavailable';
  }

  relativeTime(timestamp: string) {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(`${timestamp.replace(' ', 'T')}Z`).getTime()) / 1000));
    if (seconds < 60) return 'just now';
    const [unit, size] = ([['year', 31557600], ['month', 2629800], ['day', 86400], ['hour', 3600], ['minute', 60]] as const).find(([, duration]) => seconds >= duration) || ['minute', 60];
    const amount = Math.floor(seconds / size);
    return `${amount} ${unit}${amount === 1 ? '' : 's'} ago`;
  }

  receive(request: PurchaseRequest) {
    this.api.request(request.id).subscribe({next: detail => {
      if (!detail.items?.some(item => (item.quantity_received || 0) < item.quantity)) {
        this.notifications.info('All items have already been received'); return;
      }
      this.dialog.open(ReceiveItemsDialogComponent, {data: detail, width: '560px', maxWidth: 'calc(100vw - 32px)'}).afterClosed().subscribe((result?: ReceiveItemDialogResult) => {
        if (!result) return;
        this.api.receiveItem(request.id, result.itemId, result.quantity).subscribe({next: () => {
        this.notifications.success(`${result.quantity} item${result.quantity === 1 ? '' : 's'} received`); this.load();
        }, error: error => this.notifications.error(error.error?.error || 'Unable to receive item')});
      });
    }, error: error => this.notifications.error(error.error?.error || 'Unable to load request details')});
  }

  markOrdered(request: PurchaseRequest) {
    this.dialog.open(OrderDetailsDialogComponent, {data: request, width: '480px', maxWidth: 'calc(100vw - 32px)'}).afterClosed().subscribe((result?: OrderDetailsDialogResult) => {
      if (!result) return;
      this.api.markOrdered(request.id, result).subscribe({next: () => {
        this.notifications.success('Order marked as placed'); this.load();
      }, error: error => this.notifications.error(error.error?.error || 'Unable to mark order as placed')});
    });
  }

  viewOrderDetails(request: PurchaseRequest) {
    this.api.request(request.id).subscribe({next: detail => {
      this.dialog.open(OrderDetailsDialogComponent, {data: detail, width: '560px', maxWidth: 'calc(100vw - 32px)'}).afterClosed().subscribe((result?: OrderDetailsDialogResult) => {
        if (!result) return;
        this.api.updateTracking(request.id, {
          actual_amount_spent: result.actualAmountSpent,
          funding_source_id: result.fundingSourceId,
          tracking_number: result.trackingNumber,
          estimated_delivery_date: result.estimatedDeliveryDate,
          tax_amount: result.taxAmount,
          shipping_cost: result.shippingCost,
          tariff_cost: result.tariffCost
        }).subscribe({next: () => {
          this.notifications.success('Order details updated'); this.load();
        }, error: error => this.notifications.error(error.error?.error || 'Unable to update order details')});
      });
    }, error: error => this.notifications.error(error.error?.error || 'Unable to load order details')});
  }

  cancelOrder(request: PurchaseRequest) {
    this.dialog.open(CancelOrderDialogComponent, {data: request}).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.api.cancelOrder(request.id).subscribe({next: () => {
        this.notifications.success('Order cancelled'); this.load();
      }, error: error => this.notifications.error(error.error?.error || 'Unable to cancel order')});
    });
  }
}
