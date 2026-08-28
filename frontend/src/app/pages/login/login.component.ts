import {CommonModule} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {AuthService} from '../../core/auth.service';

const ERROR_MESSAGES: Record<string, string> = {
  oidc_session_expired: 'Your sign-in session expired. Please try again.',
  oidc_failed: 'Unable to sign in. Please try again or contact an administrator.',
  oidc_unavailable:
    'Sign-in is temporarily unavailable. Please try again shortly or contact an administrator.'
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
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
