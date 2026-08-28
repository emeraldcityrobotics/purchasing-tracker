import {Injectable, inject} from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';

export type ToastType = 'success' | 'error' | 'info';

@Injectable({providedIn: 'root'})
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string) {
    this.show(message, 'success');
  }

  error(message: string) {
    this.show(message, 'error');
  }

  info(message: string) {
    this.show(message, 'info');
  }

  private show(message: string, type: ToastType) {
    this.snackBar.open(message, 'Dismiss', {
      duration: 3500,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: [`toast-${type}`]
    });
  }
}
