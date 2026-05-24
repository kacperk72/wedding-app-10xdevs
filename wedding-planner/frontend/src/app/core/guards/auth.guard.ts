import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.token()) return router.createUrlTree(['/']);

  const isSetupRoute = state.url.startsWith('/app/setup');

  return auth.ensureUser().pipe(
    map((user): boolean | UrlTree => {
      if (!user) return router.createUrlTree(['/']);
      if (!user.weddingId && !isSetupRoute) return router.createUrlTree(['/app/setup']);
      if (user.weddingId && isSetupRoute) return router.createUrlTree(['/app']);
      return true;
    }),
    catchError(() => of(router.createUrlTree(['/']))),
  );
};
