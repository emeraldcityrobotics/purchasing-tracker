import {CommonModule} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {AuthService} from '../../core/auth.service';

const ERROR_MESSAGES: Record<string, string> = {
  oidc_session_expired: 'Your sign-in session expired. Please try again.',
  oidc_failed: 'Unable to sign in. Please try again or contact an administrator.'
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styles: [`.auth-page{min-height:70vh;display:grid;place-items:center}.auth-panel{width:min(430px,100%);background:white;border:1px solid var(--line);border-radius:16px;padding:36px;box-shadow:var(--shadow);text-align:center}h1{font-size:42px;margin-bottom:8px}.auth-panel button{width:100%;margin-top:28px}`]
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  readonly error = signal(this.errorMessage());

  signIn() {
    this.auth.loginWithOidc();
  }

  private errorMessage(): string {
    const code = this.route.snapshot.queryParamMap.get('error');
    return (code && ERROR_MESSAGES[code]) || '';
  }
}
