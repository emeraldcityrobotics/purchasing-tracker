import {CommonModule} from '@angular/common';
import {Component, inject} from '@angular/core';
import {FormBuilder, FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {PurchaseRequest, RequestItem} from '../../core/models';

export interface ReceiveItemDialogResult {
  itemId: number;
  quantity: number;
}

@Component({
  selector: 'app-receive-items-dialog',
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  templateUrl: './receive-items-dialog.component.html',
  styleUrl: './receive-items-dialog.component.scss'
})
export class ReceiveItemsDialogComponent {
  readonly request = inject<PurchaseRequest>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ReceiveItemsDialogComponent, ReceiveItemDialogResult>);
  readonly quantities = this.fb.group(
    Object.fromEntries(
      (this.request.items || []).map(item => [item.id!, this.fb.nonNullable.control(1, [Validators.required, Validators.min(1), Validators.max(this.remaining(item))])])
    )
  );

  remaining(item: RequestItem) {
    return item.quantity - (item.quantity_received || 0);
  }

  quantityControl(item: RequestItem): FormControl<number> {
    return this.quantities.controls[item.id!];
  }

  receive(item: RequestItem) {
    const control = this.quantityControl(item);
    const quantity = control.value;
    if (!item.id || control.invalid) return;
    this.dialogRef.close({itemId: item.id, quantity});
  }
}
