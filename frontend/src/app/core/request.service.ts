import {Injectable} from '@angular/core';
import {PurchaseRequest, RequestItem, RequestTotals} from './models';

@Injectable({providedIn: 'root'})
export class RequestService {
  calculateTotals(items: RequestItem[], taxRate: number, shipping = 0, tariff = 0): RequestTotals {
    const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
    const taxAmount = subtotal * (Number(taxRate || 0) / 100);
    return {subtotal, taxAmount, shipping: Number(shipping || 0), tariff: Number(tariff || 0), total: subtotal + taxAmount + Number(shipping || 0) + Number(tariff || 0)};
  }

  lineTotal(item: RequestItem) {
    return Number(item.quantity || 0) * Number(item.unit_price || 0);
  }

  progress(request: PurchaseRequest) {
    if (request.items?.length) {
      const total = request.items.reduce((sum, item) => sum + item.quantity, 0);
      const received = request.items.reduce((sum, item) => sum + Number(item.quantity_received || 0), 0);
      return total ? Math.round(received / total * 100) : 0;
    }
    return ({pending: 0, rejected: 0, approved: 25, ordered: 50, partially_received: 75, completed: 100} as Record<string, number>)[request.status] ?? 0;
  }

  statusLabel(status: PurchaseRequest['status']) {
    return status.replace('_', ' ');
  }
}
