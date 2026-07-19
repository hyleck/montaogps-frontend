import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UserActivityService {
  start(): void {
    // Activity is recorded by the backend for GPS views and create/update/delete actions.
  }
}
