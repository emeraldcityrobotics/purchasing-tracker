import {Injectable, signal} from '@angular/core';

export interface Toast {id: number; message: string; type: 'success' | 'error' | 'info'}

@Injectable({providedIn: 'root'})
export class NotificationService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 0;
  success(message: string) {
    this.show(message, 'success');
  }

  error(message: string) {
    this.show(message, 'error');
  }

  info(message: string) {
    this.show(message, 'info');
  }

  private show(message: string, type: Toast['type']) {
    const id = ++this.nextId;
    this.toasts.update(toasts => [...toasts, {id, message, type}]);
    setTimeout(() => this.toasts.update(toasts => toasts.filter(toast => toast.id !== id)), 3500);
  }
}
