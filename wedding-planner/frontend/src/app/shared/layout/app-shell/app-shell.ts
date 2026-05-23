import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppSidebar } from '../app-sidebar/app-sidebar';
import { AppHeader } from '../app-header/app-header';
import { MobileBottomNav } from '../mobile-bottom-nav/mobile-bottom-nav';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, AppSidebar, AppHeader, MobileBottomNav],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {}
