import {CommonModule} from '@angular/common';
import {Component, inject} from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {AuthService} from '../../core/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styles: [`.topbar{min-height:72px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:30px;padding:0 36px;position:sticky;top:0;z-index:5}.brand{display:flex;align-items:center;gap:10px;color:var(--ink);font-family:'Space Grotesk';font-weight:700;text-decoration:none;white-space:nowrap}.brand-mark{background:var(--green);color:white;padding:8px 7px;border-radius:7px;font-size:11px}nav{display:flex;gap:4px;flex:1}nav a,.login-link{padding:10px 12px;color:var(--muted);text-decoration:none;font-weight:700;font-size:13px;border-radius:7px}nav a.active,nav a:hover{background:var(--mint);color:var(--green-dark)}.account{display:flex;gap:10px;align-items:center;font-size:13px}.account small{background:var(--mint);color:var(--green-dark);padding:4px 8px;border-radius:99px;text-transform:uppercase;font-weight:700;font-size:10px}.account button{border:0;background:none;color:var(--red);font-weight:700}@media(max-width:800px){.topbar{padding:12px 16px;flex-wrap:wrap;gap:10px}.brand{width:100%}nav{order:3;width:100%;overflow:auto}.account{position:absolute;right:16px;top:18px}.account span,.account small{display:none}}`]
})
export class ShellComponent {
  readonly auth = inject(AuthService);
}
