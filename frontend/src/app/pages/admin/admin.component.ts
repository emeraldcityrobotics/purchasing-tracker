import {CommonModule} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatListModule} from '@angular/material/list';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatTabsModule} from '@angular/material/tabs';
import {ApiService} from '../../core/api.service';
import {NotificationService} from '../../core/notification.service';
import {Department, FundingSource, Settings, User, Vendor} from '../../core/models';
import {CategoryDialogComponent, CategoryDialogResult} from './category-dialog.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTabsModule
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent {
  private readonly api = inject(ApiService); private readonly dialog = inject(MatDialog); private readonly notifications = inject(NotificationService); readonly tab = signal<'users' | 'vendors' | 'departments' | 'funding' | 'settings'>('users'); readonly users = signal<User[]>([]); readonly vendors = signal<Vendor[]>([]); readonly departments = signal<Department[]>([]); readonly funding = signal<FundingSource[]>([]); readonly importingInvenTreeVendors = signal(false); newName = ''; newDescription = ''; settings: Settings | null = null;
  readonly tabs = ['users', 'vendors', 'departments', 'funding', 'settings'] as const;

  onTabChange(index: number) {
    this.tab.set(this.tabs[index]);
  }

  constructor() {
    this.load();
  }

  load() {
    this.api.users().subscribe(result => this.users.set(result.users)); this.api.vendors().subscribe(result => this.vendors.set(result.vendors)); this.api.departments().subscribe(result => this.departments.set(result.departments)); this.api.fundingSources().subscribe(result => this.funding.set(result.fundingSources)); this.api.settings().subscribe(result => this.settings = result);
  }

  saveSettings() {
    if (!this.settings) return;
    this.api.updateSettings(this.settings).subscribe({next: () => this.notifications.success('Settings saved'), error: () => this.notifications.error('Unable to save settings')});
  }

  testSlack() {
    if (!this.settings?.slack_webhook_url) return;
    this.api.testSlack(this.settings.slack_webhook_url).subscribe({next: result => result.success ? this.notifications.success('Slack test message sent') : this.notifications.error(result.error || 'Slack test failed'), error: () => this.notifications.error('Slack test failed')});
  }

  testSheets() {
    this.api.testSheets().subscribe({next: result => result.success ? this.notifications.success('Google Sheets test succeeded') : this.notifications.error(result.error || 'Google Sheets test failed'), error: () => this.notifications.error('Google Sheets test failed')});
  }

  testInvenTree() {
    if (!this.settings?.inventree_url || !this.settings?.inventree_api_key) return;
    this.api.testInvenTree(this.settings.inventree_url, this.settings.inventree_api_key).subscribe({next: result => result.success ? this.notifications.success(result.message || 'InvenTree connection verified') : this.notifications.error(result.message || 'InvenTree connection failed'), error: () => this.notifications.error('InvenTree connection failed')});
  }

  add() {
    if (!this.newName.trim()) return; const done = () => {
      this.notifications.success('Added successfully'); this.newName = ''; this.newDescription = ''; this.load();
    }; if (this.tab() === 'vendors') this.api.createVendor({name: this.newName}).subscribe({next: done, error: () => this.notifications.error('Unable to add vendor')}); if (this.tab() === 'departments') this.api.createDepartment({name: this.newName}).subscribe({next: done, error: () => this.notifications.error('Unable to add category')}); if (this.tab() === 'funding') this.api.createFundingSource({name: this.newName, description: this.newDescription}).subscribe({next: done, error: () => this.notifications.error('Unable to add funding source')});
  }

  importFromInvenTree() {
    this.importingInvenTreeVendors.set(true);
    this.api.importInvenTreeVendors().subscribe({
      next: result => {
        this.importingInvenTreeVendors.set(false);
        if (!result.success) { this.notifications.error(result.message || 'Unable to import InvenTree vendors'); return; }
        this.notifications.success(`Imported ${result.count ?? 0} vendor${result.count === 1 ? '' : 's'} from InvenTree`); this.load();
      },
      error: () => { this.importingInvenTreeVendors.set(false); this.notifications.error('Unable to import InvenTree vendors'); }
    });
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
