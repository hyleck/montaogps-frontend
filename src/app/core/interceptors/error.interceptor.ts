import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { getApiErrorMessage } from '../utils/api-error.util';

export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const detail = getApiErrorMessage(
        error,
        `La solicitud ${req.method} ${req.urlWithParams} falló`,
      );
      console.error(`[HTTP ${error.status || 'sin respuesta'}] ${req.method} ${req.urlWithParams}: ${detail}`);

      if (error.status === 401) {
        // Verificar si es un error JWT específico (código 1017)
        if (error.error?.code === 1017) {
          // Si ya estamos en el login, no recargar la página
          if (window.location.pathname.includes('/login')) {
            return throwError(() => error);
          }

          const supportSession = sessionStorage.getItem('support_original_session');
          if (supportSession) {
            try {
              const original = JSON.parse(supportSession);
              if (original?.token && original?.user) {
                localStorage.setItem('authtoken', original.token);
                localStorage.setItem('user', original.user);
                if (original.sessionDate) {
                  localStorage.setItem('session_date', original.sessionDate);
                } else {
                  localStorage.removeItem('session_date');
                }
                sessionStorage.removeItem('support_original_session');
                window.location.href = '/admin/management';
                return throwError(() => error);
              }
            } catch (restoreError) {
              console.error('No fue posible restaurar la sesión root de soporte:', restoreError);
            }
          }

          // Limpiar el token y redirigir al login
          localStorage.removeItem('authtoken');
          localStorage.removeItem('user');

          // Redirigir al login
          window.location.href = '/login';

          // Mostrar mensaje específico para JWT
          console.error('Token JWT expirado o inválido:', detail);
        }
      }

      return throwError(() => error);
    })
  );
};
