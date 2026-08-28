import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {ShellComponent} from './shared/shell/shell.component';
import {ToastComponent} from './shared/toast/toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ShellComponent, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
}
