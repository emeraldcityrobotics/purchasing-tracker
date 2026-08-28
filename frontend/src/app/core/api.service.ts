import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {Department, FundingSource, PurchaseRequest, RequestItem, Settings, User, Vendor} from './models';

@Injectable({providedIn: 'root'})
export class ApiService {
  private readonly http = inject(HttpClient);

  login(username: string, password: string) {
    return this.http.post<{success: boolean; user: User; error?: string}>('/api/login', {username, password});
  }

  logout() {
    return this.http.post<{success: boolean}>('/api/logout', {});
  }

  authCheck() {
    return this.http.get<{authenticated: boolean; userId?: number; role?: User['role']; fullName?: string}>('/api/auth/check');
  }

  vendors(publicApi = false): Observable<Vendor[] | {vendors: Vendor[]}> {
    return this.http.get<Vendor[] | {vendors: Vendor[]}>(publicApi ? '/api/public/vendors' : '/api/vendors');
  }

  createVendor(data: Partial<Vendor>, publicApi = false) {
    return this.http.post<{success: boolean; id: number; error?: string}>(publicApi ? '/api/public/vendors' : '/api/vendors', data);
  }

  deleteVendor(id: number) {
    return this.http.delete<{success: boolean}>(`/api/vendors/${id}`);
  }

  departments(publicApi = false): Observable<Department[] | {departments: Department[]}> {
    return this.http.get<Department[] | {departments: Department[]}>(publicApi ? '/api/public/departments' : '/api/departments');
  }

  createDepartment(data: Partial<Department>, publicApi = false) {
    return this.http.post<{success: boolean; id: number; error?: string}>(publicApi ? '/api/public/departments' : '/api/departments', data);
  }

  updateDepartment(id: number, data: Partial<Department>) {
    return this.http.put<{success: boolean}>(`/api/departments/${id}`, data);
  }

  deleteDepartment(id: number) {
    return this.http.delete<{success: boolean}>(`/api/departments/${id}`);
  }

  fundingSources() {
    return this.http.get<{fundingSources: FundingSource[]}>('/api/funding-sources');
  }

  createFundingSource(data: Partial<FundingSource>) {
    return this.http.post<{success: boolean; id: number}>(`/api/funding-sources`, data);
  }

  updateFundingSource(id: number, data: Partial<FundingSource>) {
    return this.http.put<{success: boolean}>(`/api/funding-sources/${id}`, data);
  }

  deleteFundingSource(id: number) {
    return this.http.delete<{success: boolean}>(`/api/funding-sources/${id}`);
  }

  requests() {
    return this.http.get<PurchaseRequest[]>('/api/purchase-requests');
  }

  request(id: number) {
    return this.http.get<PurchaseRequest>(`/api/purchase-requests/${id}`);
  }

  createRequest(data: object, publicApi = false) {
    return this.http.post<{success: boolean; id: number; error?: string}>(publicApi ? '/api/public/purchase-requests' : '/api/purchase-requests', data);
  }

  updateStatus(id: number, data: object) {
    return this.http.put<{success: boolean; message?: string; approved?: boolean; approvalCount?: number; required?: number; error?: string}>(`/api/purchase-requests/${id}/status`, data);
  }

  overrideApproval(id: number) {
    return this.http.put<{success: boolean; message?: string}>(`/api/purchase-requests/${id}/admin-override`, {});
  }

  updateTracking(id: number, data: object) {
    return this.http.put<{success: boolean; error?: string}>(`/api/purchase-requests/${id}/tracking`, data);
  }

  receiveItem(requestId: number, itemId: number, quantity_received: number) {
    return this.http.put<{success: boolean; newStatus: PurchaseRequest['status']}>(`/api/purchase-requests/${requestId}/items/${itemId}/receive`, {quantity_received});
  }

  exportRequest(id: number) {
    return this.http.post<{success: boolean; message?: string}>(`/api/google-sheets/export/${id}`, {});
  }

  users() {
    return this.http.get<{users: User[]}>('/api/users');
  }

  approvers() {
    return this.http.get<{approvers: Array<{id: number; full_name: string}>}>('/api/approvers');
  }

  createUser(data: object) {
    return this.http.post<{success: boolean; error?: string}>('/api/users', data);
  }

  updateUser(id: number, data: object) {
    return this.http.put<{success: boolean; error?: string}>(`/api/users/${id}`, data);
  }

  deleteUser(id: number) {
    return this.http.delete<{success: boolean; error?: string}>(`/api/users/${id}`);
  }

  settings() {
    return this.http.get<Settings>('/api/settings');
  }

  updateSettings(data: Partial<Settings>) {
    return this.http.put<Settings & {success: boolean}>('/api/settings', data);
  }

  testSlack(webhook_url: string) {
    return this.http.post<{success: boolean; error?: string}>('/api/settings/test-slack', {webhook_url});
  }

  testSheets() {
    return this.http.post<{success: boolean; error?: string}>('/api/google-sheets/test', {});
  }

  publicStatus() {
    return this.http.get<PurchaseRequest[]>('/api/public/purchase-requests/status');
  }
}
