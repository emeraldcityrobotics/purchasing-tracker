import {CommonModule} from '@angular/common';
import {Component, inject} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatMenuModule} from '@angular/material/menu';
import {MatToolbarModule} from '@angular/material/toolbar';
import {AuthService} from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatToolbarModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly auth = inject(AuthService);

  constructor() {
    // Syncs auth state with the session cookie, e.g. after an OIDC login redirect.
    this.auth.check().subscribe();
  }
}
