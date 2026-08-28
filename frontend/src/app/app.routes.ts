import {Routes} from '@angular/router';
import {authGuard, roleGuard} from './core/auth.guard';

export const routes: Routes = [
  {path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)},
  {path: 'request', loadComponent: () => import('./pages/request/request.component').then(m => m.RequestComponent)},
  {path: 'approvals', canActivate: [authGuard, roleGuard('admin', 'approver')], loadComponent: () => import('./pages/approvals/approvals.component').then(m => m.ApprovalsComponent)},
  {path: 'tracking', canActivate: [authGuard], loadComponent: () => import('./pages/tracking/tracking.component').then(m => m.TrackingComponent)},
  {path: 'admin', canActivate: [authGuard, roleGuard('admin')], loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent)},
  {path: '', pathMatch: 'full', redirectTo: 'request'},
  {path: '**', redirectTo: 'request'}
];
