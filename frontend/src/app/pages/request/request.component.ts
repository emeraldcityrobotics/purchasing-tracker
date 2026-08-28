import {CommonModule, CurrencyPipe} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ApiService} from '../../core/api.service';
import {Department, RequestItem, Vendor} from '../../core/models';
import {NotificationService} from '../../core/notification.service';
import {RequestService} from '../../core/request.service';
@Component({selector: 'app-request', standalone: true, imports: [CommonModule, CurrencyPipe, FormsModule], templateUrl: './request.component.html', styleUrl: './request.component.scss'})
export class RequestComponent {
  private readonly api = inject(ApiService); public readonly calculator = inject(RequestService); private readonly notifications = inject(NotificationService); readonly vendors = signal<Vendor[]>([]); readonly departments = signal<Department[]>([]); readonly accessGranted = signal(sessionStorage.getItem('purchaseRequestAccess') === 'true'); readonly status = signal<any[]>([]); readonly error = signal(''); accessCode = ''; requesterName = ''; departmentId = ''; vendorId = ''; orderName = ''; taxRate = 11; shipping = 0; tariff = 0; requestedArrivalDate = ''; notes = ''; items: RequestItem[] = [this.newItem()]; constructor() {
    this.api.publicStatus().subscribe(data => this.status.set(data)); if (this.accessGranted()) this.loadOptions();
  }

  newItem(): RequestItem {
    return {product_name: '', description: '', purchase_link: '', quantity: 1, unit_price: 0};
  }

  unlock() {
    if (this.accessCode === '8248') {
      sessionStorage.setItem('purchaseRequestAccess', 'true'); this.accessGranted.set(true); this.loadOptions();
    } else this.error.set('Invalid access code');
  }

  loadOptions() {
    this.api.vendors(true).subscribe(data => this.vendors.set(Array.isArray(data) ? data : data.vendors)); this.api.departments(true).subscribe(data => this.departments.set(Array.isArray(data) ? data : data.departments));
  }

  addItem() {
    this.items = [...this.items, this.newItem()];
  }

  removeItem(index: number) {
    if (this.items.length > 1) this.items = this.items.filter((_, itemIndex) => itemIndex !== index);
  }

  totals() {
    return this.calculator.calculateTotals(this.items, this.taxRate, this.shipping, this.tariff);
  }

  submit() {
    this.error.set(''); if (!this.requesterName || !this.departmentId || !this.vendorId || this.items.some(item => !item.product_name || item.quantity < 1 || item.unit_price < 0)) {
      this.error.set('Complete the required fields and item details.'); return;
    } this.api.createRequest({vendor_id: +this.vendorId, department_id: +this.departmentId, requester_name: this.requesterName, order_name: this.orderName, items: this.items.map(item => ({...item, line_total: this.calculator.lineTotal(item)})), tax_rate: this.taxRate, shipping_cost: this.shipping, tariff_cost: this.tariff, notes: this.notes, requested_arrival_date: this.requestedArrivalDate}, true).subscribe({next: () => {
      this.notifications.success('Purchase request submitted'); this.requesterName = ''; this.orderName = ''; this.items = [this.newItem()]; this.notes = '';
    }, error: err => this.error.set(err.error?.error || 'Unable to submit request')});
  }
}
