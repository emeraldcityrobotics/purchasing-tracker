import {CommonModule} from '@angular/common';
import {Component, inject} from '@angular/core';
import {NotificationService} from '../../core/notification.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html'
})
export class ToastComponent {
  readonly notifications = inject(NotificationService);
}
