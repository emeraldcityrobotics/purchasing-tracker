import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {ApiService} from '../../core/api.service';
import {Department} from '../../core/models';

export interface CategoryDialogResult {
  name: string;
  approver_id: number | null;
  slack_approval_message: string;
}

@Component({
  selector: 'app-category-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './category-dialog.component.html',
  styleUrl: './category-dialog.component.scss'
})
export class CategoryDialogComponent {
  readonly category = inject<Department>(MAT_DIALOG_DATA);
  private readonly api = inject(ApiService);
  private readonly dialogRef = inject(MatDialogRef<CategoryDialogComponent, CategoryDialogResult>);
  readonly approvers = signal<Array<{id: number; full_name: string}>>([]);
  name = this.category.name;
  approverId = this.category.approver_id?.toString() ?? '';
  slackApprovalMessage = this.category.slack_approval_message ?? '';

  constructor() {
    this.api.approvers().subscribe(result => this.approvers.set(result.approvers));
  }

  save() {
    if (!this.name.trim()) return;
    this.dialogRef.close({name: this.name.trim(), approver_id: this.approverId ? +this.approverId : null, slack_approval_message: this.slackApprovalMessage});
  }
}