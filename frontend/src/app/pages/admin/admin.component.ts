import {CommonModule} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatListModule} from '@angular/material/list';
import {MatSelectModule} from '@angular/material/select';
import {MatTabsModule} from '@angular/material/tabs';
import {ApiService} from '../../core/api.service';
import {NotificationService} from '../../core/notification.service';
import {Department, FundingSource, User, Vendor} from '../../core/models';

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
    MatSelectModule,
    MatTabsModule
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent {
  private readonly api = inject(ApiService); private readonly notifications = inject(NotificationService); readonly tab = signal<'users' | 'vendors' | 'departments' | 'funding'>('users'); readonly users = signal<User[]>([]); readonly vendors = signal<Vendor[]>([]); readonly departments = signal<Department[]>([]); readonly funding = signal<FundingSource[]>([]); newName = ''; newDescription = ''; newRole = 'purchaser'; newPassword = '';
  readonly tabs = ['users', 'vendors', 'departments', 'funding'] as const;

  onTabChange(index: number) {
    this.tab.set(this.tabs[index]);
  }

  constructor() {
    this.load();
  }

  load() {
    this.api.users().subscribe(result => this.users.set(result.users)); this.api.vendors().subscribe(result => this.vendors.set(result.vendors)); this.api.departments().subscribe(result => this.departments.set(result.departments)); this.api.fundingSources().subscribe(result => this.funding.set(result.fundingSources));
  }

  add() {
    if (!this.newName.trim()) return; const done = () => {
      this.notifications.success('Added successfully'); this.newName = ''; this.newDescription = ''; this.load();
    }; if (this.tab() === 'vendors') this.api.createVendor({name: this.newName}).subscribe({next: done, error: () => this.notifications.error('Unable to add vendor')}); if (this.tab() === 'departments') this.api.createDepartment({name: this.newName}).subscribe({next: done, error: () => this.notifications.error('Unable to add category')}); if (this.tab() === 'funding') this.api.createFundingSource({name: this.newName, description: this.newDescription}).subscribe({next: done, error: () => this.notifications.error('Unable to add funding source')}); if (this.tab() === 'users') this.api.createUser({username: this.newName, password: this.newPassword, full_name: this.newDescription, role: this.newRole}).subscribe({next: done, error: () => this.notifications.error('Unable to add user')});
  }

  remove(kind: 'user' | 'vendor' | 'department' | 'funding', id: number) {
    const calls = {user: this.api.deleteUser(id), vendor: this.api.deleteVendor(id), department: this.api.deleteDepartment(id), funding: this.api.deleteFundingSource(id)}; calls[kind].subscribe({next: () => {
      this.notifications.success('Removed'); this.load();
    }, error: () => this.notifications.error('Unable to remove record')});
  }
}
