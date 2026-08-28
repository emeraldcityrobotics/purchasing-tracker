import {CommonModule} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {AuthService} from '../../core/auth.service';
import {NotificationService} from '../../core/notification.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styles: [`.auth-page{min-height:70vh;display:grid;place-items:center}.auth-panel{width:min(430px,100%);background:white;border:1px solid var(--line);border-radius:16px;padding:36px;box-shadow:var(--shadow)}h1{font-size:42px;margin-bottom:8px}.auth-panel form{display:grid;gap:18px;margin-top:28px}.auth-panel button{width:100%}`]
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  username = '';
  password = '';
  readonly busy = signal(false);
  readonly error = signal('');

  submit() {
    this.busy.set(true);
    this.error.set('');
    this.auth.login(this.username, this.password).subscribe({
      next: () => {
        this.busy.set(false); this.notifications.success('Signed in successfully'); void this.router.navigateByUrl('/tracking');
      },
      error: (error) => {
        this.busy.set(false); this.error.set(error.error?.error || 'Unable to sign in');
      }
    });
  }
}
