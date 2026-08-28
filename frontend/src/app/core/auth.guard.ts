import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {map} from 'rxjs';
import {AuthService} from './auth.service';
import {Role} from './models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.check().pipe(map(() => auth.state().authenticated ? true : router.createUrlTree(['/login'])));
};

export const roleGuard = (...roles: Role[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.check().pipe(map(() => auth.hasRole(...roles) ? true : router.createUrlTree(['/tracking'])));
};
