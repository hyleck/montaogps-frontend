import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Verificar si es un error JWT específico (código 1017)
        if (error.error?.code === 1017) {
          // Limpiar el token y redirigir al login
          localStorage.removeItem('authtoken');
          localStorage.removeItem('user');
          
          // Redirigir al login
          window.location.href = '/login';
          
          // Mostrar mensaje específico para JWT
          console.error('Token JWT expirado o inválido:', error.error.message);
        }
      }
      
      return throwError(() => error);
    })
  );
};
