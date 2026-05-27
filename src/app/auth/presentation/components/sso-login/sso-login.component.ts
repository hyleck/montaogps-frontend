import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-sso-login',
  templateUrl: './sso-login.component.html',
  styleUrl: './sso-login.component.css',
  standalone: false
})
export class SsoLoginComponent implements OnInit {
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    const user = this.route.snapshot.queryParamMap.get('user');

    if (!token) {
      this.errorMessage = 'No se recibio una sesion valida.';
      return;
    }

    localStorage.setItem('authtoken', token);

    if (user) {
      try {
        localStorage.setItem('user', decodeURIComponent(user));
      } catch {
        localStorage.setItem('user', user);
      }
    }

    void this.router.navigate(['/admin/management']);
  }
}
