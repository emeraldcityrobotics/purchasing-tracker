import {CommonModule, CurrencyPipe, DatePipe} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatChipsModule} from '@angular/material/chips';
import {MatTableModule} from '@angular/material/table';
import {ApiService} from '../../core/api.service';
import {NotificationService} from '../../core/notification.service';
import {PurchaseRequest} from '../../core/models';
import {RequestService} from '../../core/request.service';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, MatButtonModule, MatCardModule, MatChipsModule, MatTableModule],
  templateUrl: './approvals.component.html',
  styleUrl: './approvals.component.scss'
})
export class ApprovalsComponent {
  private readonly api = inject(ApiService); private readonly notifications = inject(NotificationService); readonly requests = signal<PurchaseRequest[]>([]); readonly requestService = inject(RequestService); readonly loading = signal(true);
  readonly columns = ['order', 'total', 'status', 'actions'];
  constructor() {
    this.load();
  }

  load() {
    this.api.requests().subscribe({next: (requests) => {
      this.requests.set(requests.filter(request => request.status === 'pending')); this.loading.set(false);
    }, error: () => this.loading.set(false)});
  }

  approve(request: PurchaseRequest) {
    this.api.updateStatus(request.id, {status: 'approved'}).subscribe({next: (result) => {
      this.notifications.success(result.message || 'Approval recorded'); this.load();
    }, error: error => this.notifications.error(error.error?.error || 'Unable to approve request')});
  }

  reject(request: PurchaseRequest) {
    this.api.updateStatus(request.id, {status: 'rejected'}).subscribe({next: () => {
      this.notifications.success('Request rejected'); this.load();
    }, error: error => this.notifications.error(error.error?.error || 'Unable to reject request')});
  }

  override(request: PurchaseRequest) {
    this.api.overrideApproval(request.id).subscribe({next: () => {
      this.notifications.success('Request approved by admin override'); this.load();
    }, error: error => this.notifications.error(error.error?.error || 'Unable to override request')});
  }
}
