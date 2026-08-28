import {CommonModule, CurrencyPipe, DatePipe} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {ApiService} from '../../core/api.service';
import {NotificationService} from '../../core/notification.service';
import {PurchaseRequest, RequestStatus} from '../../core/models';
import {RequestService} from '../../core/request.service';

@Component({selector: 'app-tracking', standalone: true, imports: [CommonModule, CurrencyPipe, DatePipe], templateUrl: './tracking.component.html', styles: [`.filters{display:flex;gap:12px;align-items:center;margin-bottom:20px}.order-list{display:grid;gap:12px}.order{display:grid;grid-template-columns:1.5fr .8fr .9fr .8fr 1fr auto;gap:16px;align-items:center;padding:18px;border-bottom:1px solid var(--line)}.meta{color:var(--muted);font-size:12px;margin-top:5px}.metric{font-size:13px}.metric small{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}.progress-wrap{min-width:130px}.progress-label{font-size:11px;color:var(--muted);margin-top:4px}@media(max-width:900px){.order{grid-template-columns:1fr 1fr}.progress-wrap{min-width:0}}`]})
export class TrackingComponent {
  private readonly api = inject(ApiService); private readonly notifications = inject(NotificationService); readonly requestService = inject(RequestService); readonly requests = signal<PurchaseRequest[]>([]); readonly filter = signal<'all' | RequestStatus>('all'); readonly loading = signal(true);
  constructor() {
    this.load();
  }

  load() {
    this.api.requests().subscribe({next: (requests) => {
      this.requests.set(requests); this.loading.set(false);
    }, error: () => this.loading.set(false)});
  }

  visible() {
    const filter = this.filter(); return filter === 'all' ? this.requests().filter(request => request.status !== 'rejected') : this.requests().filter(request => request.status === filter);
  }

  receive(request: PurchaseRequest) {
    if (!request.items?.length) return; const item = request.items.find(candidate => (candidate.quantity_received || 0) < candidate.quantity); if (!item?.id) return; this.api.receiveItem(request.id, item.id, 1).subscribe({next: () => {
      this.notifications.success('One item received'); this.load();
    }, error: error => this.notifications.error(error.error?.error || 'Unable to receive item')});
  }
}
