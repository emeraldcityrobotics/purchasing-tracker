import {Component, inject} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {ShellComponent} from './shared/shell/shell.component';
import {ToastComponent} from './shared/toast/toast.component';
import {AuthService} from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ShellComponent, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly auth = inject(AuthService);

  constructor() {
    // Syncs auth state with the session cookie, e.g. after an OIDC login redirect.
    this.auth.check().subscribe();
  }
}
