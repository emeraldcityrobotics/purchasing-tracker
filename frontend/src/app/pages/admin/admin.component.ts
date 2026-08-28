import {CommonModule} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ApiService} from '../../core/api.service';
import {NotificationService} from '../../core/notification.service';
import {Department, FundingSource, User, Vendor} from '../../core/models';

@Component({selector: 'app-admin', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './admin.component.html', styles: [`.admin-tabs{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}.admin-tabs button.active{background:var(--green);color:#fff}.form-row{display:flex;gap:10px;margin-bottom:20px}.form-row>*{flex:1}.records{display:grid;gap:10px}.record{display:flex;justify-content:space-between;gap:12px;padding:14px 0;border-bottom:1px solid var(--line)}@media(max-width:650px){.form-row{display:grid}.record{display:grid}}`]})
export class AdminComponent {
  private readonly api = inject(ApiService); private readonly notifications = inject(NotificationService); readonly tab = signal<'users' | 'vendors' | 'departments' | 'funding'>('users'); readonly users = signal<User[]>([]); readonly vendors = signal<Vendor[]>([]); readonly departments = signal<Department[]>([]); readonly funding = signal<FundingSource[]>([]); newName = ''; newDescription = ''; newRole = 'purchaser'; newPassword = '';
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
