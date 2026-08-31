import {CommonModule, CurrencyPipe} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {ApiService} from '../../core/api.service';
import {FundingSource, PurchaseRequest} from '../../core/models';

export interface OrderDetailsDialogResult {
  actualAmountSpent: number;
  fundingSourceId: number;
  trackingNumber: string;
  estimatedDeliveryDate: string;
  taxAmount: number;
  shippingCost: number;
  tariffCost: number;
}

@Component({
  selector: 'app-order-details-dialog',
  imports: [CommonModule, CurrencyPipe, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './order-details-dialog.component.html',
  styleUrl: './order-details-dialog.component.scss'
})
export class OrderDetailsDialogComponent {
  readonly request = inject<PurchaseRequest>(MAT_DIALOG_DATA);
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<OrderDetailsDialogComponent, OrderDetailsDialogResult>);
  readonly fundingSources = signal<FundingSource[]>([]);
  readonly isNewOrder = this.request.status === 'approved';
  readonly form = this.fb.nonNullable.group({
    actualAmountSpent: [this.request.actual_amount_spent ?? this.request.total, [Validators.required, Validators.min(0.01)]],
    fundingSourceId: [this.request.funding_source_id?.toString() ?? '', Validators.required],
    trackingNumber: [this.request.tracking_number ?? ''],
    estimatedDeliveryDate: [this.request.estimated_delivery_date ?? ''],
    taxAmount: [this.request.tax_amount, [Validators.required, Validators.min(0)]],
    shippingCost: [this.request.shipping_cost ?? 0, [Validators.required, Validators.min(0)]],
    tariffCost: [this.request.tariff_cost ?? 0, [Validators.required, Validators.min(0)]]
  });

  constructor() {
    this.api.fundingSources().subscribe(result => this.fundingSources.set(result.fundingSources.filter(source => source.is_active)));
  }

  estimatedTotal() {
    const value = this.form.getRawValue();
    return this.request.subtotal + value.taxAmount + value.shippingCost + value.tariffCost;
  }

  submit() {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.dialogRef.close({actualAmountSpent: value.actualAmountSpent, fundingSourceId: +value.fundingSourceId, trackingNumber: value.trackingNumber, estimatedDeliveryDate: value.estimatedDeliveryDate, taxAmount: value.taxAmount, shippingCost: value.shippingCost, tariffCost: value.tariffCost});
  }
}
