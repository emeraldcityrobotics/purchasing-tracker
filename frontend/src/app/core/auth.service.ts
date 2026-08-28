import {Injectable, inject, signal} from '@angular/core';
import {Router} from '@angular/router';
import {catchError, of, tap} from 'rxjs';
import {ApiService} from './api.service';
import {AuthState, Role} from './models';

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly state = signal<AuthState>({authenticated: false});

  check() {
    return this.api.authCheck().pipe(tap(auth => this.state.set(auth)));
  }

  login(username: string, password: string) {
    return this.api.login(username, password).pipe(tap((result) => {
      if (result.success) this.state.set({authenticated: true, userId: result.user.id, role: result.user.role, fullName: result.user.fullName || result.user.full_name});
    }));
  }

  logout() {
    return this.api.logout().pipe(catchError(() => of({success: true})), tap(() => {
      this.state.set({authenticated: false}); void this.router.navigateByUrl('/login');
    }));
  }

  hasRole(...roles: Role[]) {
    const role = this.state().role; return !!role && roles.includes(role);
  }
}
