import { Injectable, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '@app/core/services/user.service';
import { StatusService } from '@app/shareds/services/status.service';
import { User } from '@app/core/interfaces/user.interface';
import { AuthService } from '@app/core/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class ManagementService {
  private op: string | undefined;
  private currentUserId: string | undefined;
  private searchUsersTerm: string = '';
  private searchTargetsTerm: string = '';
  private selectedUser: User | undefined;

  constructor(
    private router: Router,
    @Inject(UserService) private userService: UserService,
    @Inject(StatusService) private status: StatusService,
    @Inject(AuthService) private authService: AuthService
  ) {}

  setOp(op: string) {
    this.op = op;
    const searchTerms: { [key: string]: string | undefined } = {
      u: this.searchUsersTerm,
      t: this.searchTargetsTerm
    };
    const searchParam = searchTerms[op];

    if (!this.currentUserId) {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        this.currentUserId = currentUser.id;
      }
    }

    this.router.navigate(
      ['admin/management', op, this.currentUserId],
      { queryParams: { search: searchParam } }
    ).then(() => {
      this.setURLStatus();
    });
  }

  setURLStatus() {
    this.status.setState('management', {
      url_query_params: { search: this.op === 'u' ? this.searchUsersTerm : this.searchTargetsTerm },
      url_route: ['admin/management', this.op, this.currentUserId]
    });
  }

  loadUserData(userId: string): Promise<User> {
    return new Promise((resolve, reject) => {
      this.userService.getById(userId).subscribe({
        next: (user: User) => {
          this.selectedUser = user;
          resolve(user);
        },
        error: (error: any) => {
          console.error('Error al cargar los datos del usuario:', error);
          this.router.navigate(['/admin/dashboard']);
          reject(error);
        }
      });
    });
  }

  verifyURLStatus(params: any) {
    this.op = params['op'];
    this.currentUserId = params['user'];
    const managementState: any = this.status.getState('management');

    if (!managementState) {
      this.goDefaultRoute();
      return;
    }

    if (managementState.url_route && managementState.url_route[1] && !params['op'] && !params['user']) {
      this.router.navigate(
        managementState.url_route,
        { queryParams: managementState.url_query_params }
      );
    } else if ((!managementState.url_route || !managementState.url_route[1]) && !params['op'] && !params['user']) {
      this.goDefaultRoute();
    }

    if (this.currentUserId) {
      this.loadUserData(this.currentUserId);
    }

    this.setURLStatus();
  }

  goDefaultRoute() {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.router.navigate(['admin/management', 'u', currentUser.id]);
    } else {
      this.router.navigate(['auth/login']);
    }
  }

  searchUser() {
    this.router.navigate(
      ['admin/management', this.op, this.currentUserId],
      { queryParams: { search: this.searchUsersTerm } }
    );
    this.setURLStatus();
  }

  searchTargets() {
    this.router.navigate(
      ['admin/management', this.op, this.currentUserId],
      { queryParams: { search: this.searchTargetsTerm } }
    );
    this.setURLStatus();
  }

  // Getters y setters
  getOp(): string | undefined {
    return this.op;
  }

  getCurrentUserId(): string | undefined {
    return this.currentUserId;
  }

  setSearchUsersTerm(term: string) {
    this.searchUsersTerm = term;
  }

  setSearchTargetsTerm(term: string) {
    this.searchTargetsTerm = term;
  }

  getSelectedUser(): User | undefined {
    return this.selectedUser;
  }
} 