import {Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
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
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './category-dialog.component.html',
  styleUrl: './category-dialog.component.scss'
})
export class CategoryDialogComponent {
  readonly category = inject<Department>(MAT_DIALOG_DATA);
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<CategoryDialogComponent, CategoryDialogResult>);
  readonly approvers = signal<Array<{id: number; full_name: string}>>([]);
  readonly form = this.fb.nonNullable.group({
    name: [this.category.name, Validators.required],
    approverId: [this.category.approver_id?.toString() ?? ''],
    slackApprovalMessage: [this.category.slack_approval_message ?? '']
  });

  constructor() {
    this.api.approvers().subscribe(result => this.approvers.set(result.approvers));
  }

  save() {
    const name = this.form.controls.name.value.trim();
    if (!name) return;
    const {approverId, slackApprovalMessage} = this.form.getRawValue();
    this.dialogRef.close({name, approver_id: approverId ? +approverId : null, slack_approval_message: slackApprovalMessage});
  }
}
