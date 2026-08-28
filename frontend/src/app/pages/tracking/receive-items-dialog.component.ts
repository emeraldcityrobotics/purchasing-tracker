import {CommonModule} from '@angular/common';
import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
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
  imports: [CommonModule, FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  templateUrl: './receive-items-dialog.component.html',
  styleUrl: './receive-items-dialog.component.scss'
})
export class ReceiveItemsDialogComponent {
  readonly request = inject<PurchaseRequest>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ReceiveItemsDialogComponent, ReceiveItemDialogResult>);
  readonly quantities = new Map<number, number>();

  remaining(item: RequestItem) {
    return item.quantity - (item.quantity_received || 0);
  }

  quantity(item: RequestItem) {
    return this.quantities.get(item.id!) ?? 1;
  }

  setQuantity(item: RequestItem, quantity: number) {
    this.quantities.set(item.id!, quantity);
  }

  receive(item: RequestItem) {
    const quantity = this.quantity(item);
    if (!item.id || quantity < 1 || quantity > this.remaining(item)) return;
    this.dialogRef.close({itemId: item.id, quantity});
  }
}
