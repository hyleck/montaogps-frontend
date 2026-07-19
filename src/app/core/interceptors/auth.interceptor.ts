import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const token = localStorage.getItem('authtoken');
  const userStr = localStorage.getItem('user');
  let headersToSet: any = { 'x-client-platform': 'desktop' };
  
  if (token) {
    headersToSet['Authorization'] = `Bearer ${token}`;
  }

  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.chatwoot_access_token) {
        headersToSet['x-chatwoot-token'] = user.chatwoot_access_token;
      }
    } catch (e) {}
  }

  if (Object.keys(headersToSet).length > 0) {
    req = req.clone({
      setHeaders: headersToSet
    });
  }

  return next(req);
}; 
