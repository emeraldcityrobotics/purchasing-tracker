import {CommonModule} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatListModule} from '@angular/material/list';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatTabsModule} from '@angular/material/tabs';
import {ApiService} from '../../core/api.service';
import {NotificationService} from '../../core/notification.service';
import {Department, FundingSource, User, Vendor} from '../../core/models';
import {CategoryDialogComponent, CategoryDialogResult} from './category-dialog.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatSlideToggleModule,
    MatTabsModule
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);
  readonly tab = signal<'users' | 'vendors' | 'departments' | 'funding' | 'settings'>('users');
  readonly users = signal<User[]>([]);
  readonly vendors = signal<Vendor[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly funding = signal<FundingSource[]>([]);
  readonly tabs = ['users', 'vendors', 'departments', 'funding', 'settings'] as const;

  readonly addForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: ['']
  });

  readonly settingsForm = this.fb.nonNullable.group({
    multi_approval_threshold: [0],
    required_approvals: [1],
    base_url: [''],
    slack_webhook_url: [''],
    slack_new_request_message: [''],
    slack_approved_message: [''],
    slack_multi_approval_message: [''],
    slack_ordered_message: [''],
    slack_arrived_message: [''],
    google_sheets_enabled: [false],
    google_apps_script_webhook: [''],
    google_sheets_auto_export: [false]
  });
  readonly settingsLoaded = signal(false);

  onTabChange(index: number) {
    this.tab.set(this.tabs[index]);
  }

  constructor() {
    this.load();
  }

  load() {
    this.api.users().subscribe(result => this.users.set(result.users));
    this.api.vendors().subscribe(result => this.vendors.set(result.vendors));
    this.api.departments().subscribe(result => this.departments.set(result.departments));
    this.api.fundingSources().subscribe(result => this.funding.set(result.fundingSources));
    this.api.settings().subscribe(result => {
      this.settingsForm.patchValue(result); this.settingsLoaded.set(true);
    });
  }

  saveSettings() {
    this.api.updateSettings(this.settingsForm.value).subscribe({next: () => this.notifications.success('Settings saved'), error: () => this.notifications.error('Unable to save settings')});
  }

  testSlack() {
    const webhookUrl = this.settingsForm.controls.slack_webhook_url.value;
    if (!webhookUrl) return;
    this.api.testSlack(webhookUrl).subscribe({next: result => result.success ? this.notifications.success('Slack test message sent') : this.notifications.error(result.error || 'Slack test failed'), error: () => this.notifications.error('Slack test failed')});
  }

  testSheets() {
    this.api.testSheets().subscribe({next: result => result.success ? this.notifications.success('Google Sheets test succeeded') : this.notifications.error(result.error || 'Google Sheets test failed'), error: () => this.notifications.error('Google Sheets test failed')});
  }

  add() {
    if (this.addForm.invalid) return;
    const {name, description} = this.addForm.getRawValue();
    const done = () => {
      this.notifications.success('Added successfully'); this.addForm.reset({name: '', description: ''}); this.load();
    };
    if (this.tab() === 'vendors') this.api.createVendor({name}).subscribe({next: done, error: () => this.notifications.error('Unable to add vendor')});
    if (this.tab() === 'departments') this.api.createDepartment({name}).subscribe({next: done, error: () => this.notifications.error('Unable to add category')});
    if (this.tab() === 'funding') this.api.createFundingSource({name, description}).subscribe({next: done, error: () => this.notifications.error('Unable to add funding source')});
  }

  editDepartment(department: Department) {
    this.dialog.open(CategoryDialogComponent, {data: department, width: '520px', maxWidth: 'calc(100vw - 32px)'}).afterClosed().subscribe((result?: CategoryDialogResult) => {
      if (!result) return;
      this.api.updateDepartment(department.id, result).subscribe({next: () => {
        this.notifications.success('Category updated'); this.load();
      }, error: () => this.notifications.error('Unable to update category')});
    });
  }

  remove(kind: 'user' | 'vendor' | 'department' | 'funding', id: number) {
    const calls = {user: this.api.deleteUser(id), vendor: this.api.deleteVendor(id), department: this.api.deleteDepartment(id), funding: this.api.deleteFundingSource(id)}; calls[kind].subscribe({next: () => {
      this.notifications.success('Removed'); this.load();
    }, error: () => this.notifications.error('Unable to remove record')});
  }
}
