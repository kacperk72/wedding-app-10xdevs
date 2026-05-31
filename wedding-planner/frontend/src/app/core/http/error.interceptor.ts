import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

export const SKIP_TOAST_HEADER = 'X-Skip-Toast';

function messageFor(error: HttpErrorResponse): string {
  if (error.status === 409) return 'Już istnieje';
  if (error.status === 403) return 'Brak uprawnień';
  if (error.status >= 500) return 'Wystąpił błąd';
  return error.error?.error || 'Nie udało się wykonać operacji';
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const skipToast = req.headers.has(SKIP_TOAST_HEADER);
  const cleanReq = skipToast ? req.clone({ headers: req.headers.delete(SKIP_TOAST_HEADER) }) : req;

  return next(cleanReq).pipe(
    catchError((err) => {
      if (!skipToast && err instanceof HttpErrorResponse && err.status >= 400) {
        toast.error(messageFor(err));
      }
      return throwError(() => err);
    }),
  );
};
