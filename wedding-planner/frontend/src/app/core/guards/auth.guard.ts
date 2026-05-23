import { CanActivateFn } from '@angular/router';

// Demo frontend stays open until backend auth is connected, so every documented route can be reviewed.
export const authGuard: CanActivateFn = () => true;
