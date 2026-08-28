import {CommonModule, CurrencyPipe, DatePipe} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatChipsModule} from '@angular/material/chips';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSelectModule} from '@angular/material/select';
import {MatTableModule} from '@angular/material/table';
import {ApiService} from '../../core/api.service';
import {NotificationService} from '../../core/notification.service';
import {PurchaseRequest, RequestStatus} from '../../core/models';
import {RequestService} from '../../core/request.service';

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
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule
  ],
  templateUrl: './tracking.component.html',
  styleUrl: './tracking.component.scss'
})
export class TrackingComponent {
  private readonly api = inject(ApiService); private readonly notifications = inject(NotificationService); readonly requestService = inject(RequestService); readonly requests = signal<PurchaseRequest[]>([]); readonly filter = signal<'all' | RequestStatus>('all'); readonly loading = signal(true);
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
    const filter = this.filter(); return filter === 'all' ? this.requests().filter(request => request.status !== 'rejected') : this.requests().filter(request => request.status === filter);
  }

  receive(request: PurchaseRequest) {
    if (!request.items?.length) return; const item = request.items.find(candidate => (candidate.quantity_received || 0) < candidate.quantity); if (!item?.id) return; this.api.receiveItem(request.id, item.id, 1).subscribe({next: () => {
      this.notifications.success('One item received'); this.load();
    }, error: error => this.notifications.error(error.error?.error || 'Unable to receive item')});
  }
}
