import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {Department, FundingSource, PurchaseRequest, RequestItem, Settings, User, Vendor} from './models';

@Injectable({providedIn: 'root'})
export class ApiService {
  private readonly http = inject(HttpClient);

  authCheck() {
    return this.http.get<{authenticated: boolean; userId?: number; role?: User['role']; fullName?: string}>('/api/auth/check');
  }

  vendors(): Observable<{vendors: Vendor[]}> {
    return this.http.get<{vendors: Vendor[]}>('/api/vendors');
  }

  createVendor(data: Partial<Vendor>) {
    return this.http.post<{success: boolean; id: number; error?: string}>('/api/vendors', data);
  }

  deleteVendor(id: number) {
    return this.http.delete<{success: boolean}>(`/api/vendors/${id}`);
  }

  departments(): Observable<{departments: Department[]}> {
    return this.http.get<{departments: Department[]}>('/api/departments');
  }

  createDepartment(data: Partial<Department>) {
    return this.http.post<{success: boolean; id: number; error?: string}>('/api/departments', data);
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

  createRequest(data: object) {
    return this.http.post<{success: boolean; id: number; error?: string}>('/api/purchase-requests', data);
  }

  updateStatus(id: number, data: object) {
    return this.http.put<{success: boolean; message?: string; approved?: boolean; approvalCount?: number; required?: number; error?: string}>(`/api/purchase-requests/${id}/status`, data);
  }

  markOrdered(id: number, data: {actualAmountSpent: number; fundingSourceId: number; trackingNumber: string; estimatedDeliveryDate: string; taxAmount: number; shippingCost: number; tariffCost: number}) {
    return this.http.put<{success: boolean}>(`/api/purchase-requests/${id}/order`, {
      actual_amount_spent: data.actualAmountSpent,
      funding_source_id: data.fundingSourceId,
      tracking_number: data.trackingNumber,
      estimated_delivery_date: data.estimatedDeliveryDate,
      tax_amount: data.taxAmount,
      shipping_cost: data.shippingCost,
      tariff_cost: data.tariffCost
    });
  }

  cancelOrder(id: number) {
    return this.http.put<{success: boolean}>(`/api/purchase-requests/${id}/cancel`, {});
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

  uploadReceipt(id: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{success: boolean; filename?: string; error?: string}>(`/api/purchase-requests/${id}/receipt`, formData);
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
}
