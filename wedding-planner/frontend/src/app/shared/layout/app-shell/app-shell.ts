import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WeddingService } from '../../../core/services/wedding.service';
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
export class AppShell implements OnInit {
  private readonly wedding = inject(WeddingService);

  ngOnInit(): void {
    this.wedding.loadCurrent().subscribe();
  }
}
