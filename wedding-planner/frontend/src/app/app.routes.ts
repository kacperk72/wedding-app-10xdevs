import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./shared/layout/marketing-shell/marketing-shell').then((m) => m.MarketingShell),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
        pathMatch: 'full',
      },
      {
        path: 'accept-invite',
        loadComponent: () =>
          import('./pages/accept-invite/accept-invite.page').then((m) => m.AcceptInvitePage),
      },
    ],
  },
  {
    path: 'app',
    loadComponent: () =>
      import('./shared/layout/app-shell/app-shell').then((m) => m.AppShell),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
        pathMatch: 'full',
      },
      {
        path: 'setup',
        loadComponent: () =>
          import('./pages/wedding-setup/wedding-setup.page').then((m) => m.WeddingSetupPage),
      },
      {
        path: 'goscie',
        loadComponent: () => import('./pages/guests/guests.page').then((m) => m.GuestsPage),
      },
      {
        path: 'kontrahenci',
        loadComponent: () =>
          import('./pages/vendors/vendors.page').then((m) => m.VendorsPage),
      },
      {
        path: 'umowy',
        loadComponent: () =>
          import('./pages/contracts/contracts.page').then((m) => m.ContractsPage),
      },
      {
        path: 'budzet',
        loadComponent: () => import('./pages/budget/budget.page').then((m) => m.BudgetPage),
      },
      {
        path: 'oferta-sali',
        loadComponent: () =>
          import('./pages/catering/catering.page').then((m) => m.CateringPage),
      },
      {
        path: 'zadania',
        loadComponent: () => import('./pages/tasks/tasks.page').then((m) => m.TasksPage),
      },
      {
        path: 'rozsadzenie',
        loadComponent: () =>
          import('./pages/seating/seating.page').then((m) => m.SeatingPage),
      },
      {
        path: 'ustawienia',
        loadComponent: () =>
          import('./pages/settings/settings.page').then((m) => m.SettingsPage),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./pages/error/error.page').then((m) => m.ErrorPage),
  },
];
