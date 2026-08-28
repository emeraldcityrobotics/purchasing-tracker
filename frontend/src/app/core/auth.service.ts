import {Injectable, inject, signal} from '@angular/core';
import {tap} from 'rxjs';
import {ApiService} from './api.service';
import {AuthState, Role} from './models';

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly api = inject(ApiService);
  readonly state = signal<AuthState>({authenticated: false});

  check() {
    return this.api.authCheck().pipe(tap(auth => this.state.set(auth)));
  }

  loginWithOidc() {
    window.location.href = '/api/auth/oidc/login';
  }

  logout() {
    window.location.href = '/api/auth/logout';
  }

  hasRole(...roles: Role[]) {
    const role = this.state().role; return !!role && roles.includes(role);
  }
}
