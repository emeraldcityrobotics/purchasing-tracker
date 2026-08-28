import {CommonModule, CurrencyPipe, DatePipe} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {ApiService} from '../../core/api.service';
import {NotificationService} from '../../core/notification.service';
import {AuthService} from '../../core/auth.service';
import {PurchaseRequest} from '../../core/models';
import {RequestService} from '../../core/request.service';

@Component({selector: 'app-approvals', standalone: true, imports: [CommonModule, CurrencyPipe, DatePipe], templateUrl: './approvals.component.html', styles: [`.approval-list{display:grid;gap:12px}.request{display:grid;grid-template-columns:1fr auto auto auto;gap:18px;align-items:center;padding:18px;border-bottom:1px solid var(--line)}.request h3{font-size:16px}.meta{color:var(--muted);font-size:12px}.actions{display:flex;gap:7px;flex-wrap:wrap}@media(max-width:800px){.request{grid-template-columns:1fr}.actions{justify-content:flex-start}}`]})
export class ApprovalsComponent {
  private readonly api = inject(ApiService); private readonly notifications = inject(NotificationService); readonly auth = inject(AuthService); readonly requests = signal<PurchaseRequest[]>([]); readonly requestService = inject(RequestService); readonly loading = signal(true);
  constructor() {
    this.load();
  }

  load() {
    this.api.requests().subscribe({next: (requests) => {
      this.requests.set(requests.filter(request => ['pending', 'approved'].includes(request.status))); this.loading.set(false);
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
