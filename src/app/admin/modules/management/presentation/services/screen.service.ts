import { Injectable, Inject } from '@angular/core';
import { StatusService } from '@app/shareds/services/status.service';

@Injectable({
  providedIn: 'root'
})
export class ScreenService {
  private isScreenSmall: boolean = false;

  constructor(@Inject(StatusService) private status: StatusService) {}

  checkScreenSize(): void {
    if (window.innerWidth < 500) {
      this.status.setState('sidebar', false);
    }

    if (window.innerWidth < 700) {
      this.status.setState('management_show_maps', { showMaps: true });
    }
  }

  getIsScreenSmall(): boolean {
    return this.isScreenSmall;
  }

  setIsScreenSmall(value: boolean): void {
    this.isScreenSmall = value;
  }
} 