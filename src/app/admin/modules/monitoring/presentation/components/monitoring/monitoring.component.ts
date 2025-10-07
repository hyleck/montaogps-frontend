import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MonitoringService, MonitorUserResponse } from '../../../../../../core/services/monitoring.service';

@Component({
  selector: 'app-monitoring',
  templateUrl: './monitoring.component.html',
  styleUrls: ['./monitoring.component.css'],
  standalone: false
})
export class MonitoringComponent implements OnInit {
  userId: string = '';
  monitoringResult: MonitorUserResponse | null = null;
  loading: boolean = false;
  error: string = '';

  constructor(
    private route: ActivatedRoute,
    private monitoringService: MonitoringService
  ) { }

  ngOnInit(): void {
    // Get user ID from route parameter but don't start monitoring automatically
    this.route.params.subscribe(params => {
      this.userId = params['user'];
      if (!this.userId) {
        // Fallback: if no user ID in route, use current user's ID
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (currentUser && currentUser.id) {
          this.userId = currentUser.id;
        } else {
          this.error = 'No user ID available for monitoring';
        }
      }
    });
  }

  startMonitoring(): void {
    this.loading = true;
    this.error = '';

    this.monitoringService.monitorUser(this.userId).subscribe({
      next: (result) => {
        this.monitoringResult = result;
        this.loading = false;
        console.log('Monitoring result:', result);
      },
      error: (error) => {
        this.error = 'Error monitoring user: ' + error.message;
        this.loading = false;
        console.error('Monitoring error:', error);
      }
    });
  }
}