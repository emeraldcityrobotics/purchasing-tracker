import {CommonModule, CurrencyPipe} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {AbstractControl, FormArray, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators} from '@angular/forms';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatGridListModule} from '@angular/material/grid-list';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {ApiService} from '../../core/api.service';
import {AuthService} from '../../core/auth.service';
import {Department, RequestItem, Vendor} from '../../core/models';
import {NotificationService} from '../../core/notification.service';
import {RequestService} from '../../core/request.service';
@Component({
  selector: 'app-request',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatGridListModule,
    MatIconModule,
    MatInputModule
  ],
  templateUrl: './request.component.html',
  styleUrl: './request.component.scss'
})
export class RequestComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  public readonly calculator = inject(RequestService);
  private readonly notifications = inject(NotificationService);
  readonly vendors = signal<Vendor[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly error = signal('');

  private readonly knownOption = (options: () => Array<{name: string}>) => (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value as string | null)?.trim();
    return value && options().some(option => option.name === value) ? null : {unknownOption: true};
  };

  readonly form = this.fb.group({
    requesterName: [{value: '', disabled: true}],
    departmentQuery: ['', [Validators.required, this.knownOption(this.departments)]],
    vendorQuery: ['', [Validators.required, this.knownOption(this.vendors)]],
    orderName: [''],
    items: this.fb.array([this.newItem()]),
    taxRate: [11],
    requestedArrivalDate: [''],
    shipping: [0],
    tariff: [0],
    notes: ['']
  });

  constructor() {
    this.form.patchValue({requesterName: this.auth.state().fullName ?? ''});
    this.loadOptions();
  }

  get items(): FormArray {
    return this.form.controls.items;
  }

  newItem() {
    return this.fb.group({
      product_name: ['', Validators.required],
      description: [''],
      purchase_link: [''],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unit_price: [0, [Validators.required, Validators.min(0)]]
    });
  }

  filteredDepartments() {
    const query = (this.form.controls.departmentQuery.value ?? '').trim().toLowerCase();
    return query ? this.departments().filter(department => department.name.toLowerCase().includes(query)) : this.departments();
  }

  filteredVendors() {
    const query = (this.form.controls.vendorQuery.value ?? '').trim().toLowerCase();
    return query ? this.vendors().filter(vendor => vendor.name.toLowerCase().includes(query)) : this.vendors();
  }

  loadOptions() {
    this.api.vendors().subscribe(data => {
      this.vendors.set(data.vendors); this.form.controls.vendorQuery.updateValueAndValidity();
    });
    this.api.departments().subscribe(data => {
      this.departments.set(data.departments); this.form.controls.departmentQuery.updateValueAndValidity();
    });
  }

  addItem() {
    this.items.push(this.newItem());
  }

  removeItem(index: number) {
    if (this.items.length > 1) this.items.removeAt(index);
  }

  lineTotal(item: AbstractControl) {
    return this.calculator.lineTotal(item.value as RequestItem);
  }

  totals() {
    const value = this.form.getRawValue();
    return this.calculator.calculateTotals(value.items as RequestItem[], value.taxRate ?? 0, value.shipping ?? 0, value.tariff ?? 0);
  }

  private findDepartment(): Department | undefined {
    return this.departments().find(department => department.name === this.form.controls.departmentQuery.value);
  }

  private findVendor(): Vendor | undefined {
    return this.vendors().find(vendor => vendor.name === this.form.controls.vendorQuery.value);
  }

  submit() {
    this.error.set('');
    const department = this.findDepartment();
    const vendor = this.findVendor();
    if (this.form.invalid || !department || !vendor) {
      this.form.markAllAsTouched();
      this.error.set('Complete the required fields and item details.');
      return;
    }
    const value = this.form.getRawValue();
    this.api.createRequest({
      vendor_id: vendor.id,
      department_id: department.id,
      requester_name: value.requesterName,
      order_name: value.orderName,
      items: (value.items as RequestItem[]).map(item => ({...item, line_total: this.calculator.lineTotal(item)})),
      tax_rate: value.taxRate,
      shipping_cost: value.shipping,
      tariff_cost: value.tariff,
      notes: value.notes,
      requested_arrival_date: value.requestedArrivalDate
    }).subscribe({
      next: () => {
        this.notifications.success('Purchase request submitted');
        this.form.patchValue({orderName: '', notes: ''});
        this.items.clear();
        this.items.push(this.newItem());
      },
      error: err => this.error.set(err.error?.error || 'Unable to submit request')
    });
  }
}
