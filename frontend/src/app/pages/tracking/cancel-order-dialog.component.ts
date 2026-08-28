import {Component, inject} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogModule} from '@angular/material/dialog';
import {PurchaseRequest} from '../../core/models';

@Component({
  selector: 'app-cancel-order-dialog',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './cancel-order-dialog.component.html',
  styleUrl: './cancel-order-dialog.component.scss'
})
export class CancelOrderDialogComponent {
  readonly request = inject<PurchaseRequest>(MAT_DIALOG_DATA);
}
