import { Injectable, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UserService } from '@app/core/services/user.service';
import { StatusService } from '@app/shareds/services/status.service';
import { User } from '@app/core/interfaces/user.interface';
import { AuthService } from '@app/core/services/auth.service';
import { MenuItem } from 'primeng/api';

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

  setOp(op: string, userId?: string) {
    const previousOp = this.op;
    const previousUserId = this.currentUserId;

    const normalizedOp = op === 't' ? 't' : 'u';
    const currentUser = this.authService.getCurrentUser();
    const nextUserId = String(
      userId || this.currentUserId || currentUser?.id || (currentUser as any)?._id || ''
    ).trim();
    if (!nextUserId) {
      this.router.navigate(['auth/login']);
      return;
    }

    this.op = normalizedOp;
    this.currentUserId = nextUserId;
    const userChanged = previousUserId !== nextUserId;
    if (userChanged) this.selectedUser = undefined;

    const searchParam = normalizedOp === 'u'
      ? this.searchUsersTerm.trim()
      : this.searchTargetsTerm.trim();
    const currentQuery = this.router.parseUrl(this.router.url).queryParams;
    const queryParams: Record<string, string> = {};
    if (searchParam) queryParams['search'] = searchParam;
    if (!userChanged && normalizedOp === 't' && currentQuery['target']) {
      queryParams['target'] = currentQuery['target'];
    }

    this.router.navigate(
      ['admin/management', normalizedOp, nextUserId],
      {
        queryParams,
        replaceUrl: !userChanged && previousOp === normalizedOp,
      }
    ).then(() => this.setURLStatus());
  }

  setURLStatus() {
    if (!this.op || !this.currentUserId) return;
    const currentQueryParams = this.router.parseUrl(this.router.url).queryParams || {};
    const newQueryParams: any = { ...currentQueryParams };
    
    // Solo agregar search si tiene valor
    const searchTerm = this.op === 'u' ? this.searchUsersTerm : this.searchTargetsTerm;
    if (searchTerm && searchTerm.trim()) {
      newQueryParams.search = searchTerm;
    }
    
    this.status.setState('management', {
      url_query_params: newQueryParams,
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

  async buildUserPath(userId: string): Promise<MenuItem[]> {
    const path: MenuItem[] = [];
    const visited = new Set<string>();
    let currentId: string | undefined = userId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const user: User = await firstValueFrom(this.userService.getById(currentId));
      path.unshift({
        label: `${user.name} ${user.last_name}`,
        routerLink: ['/admin/management', 'u', user._id]
      });
      currentId = (user as any).parent_id;
    }

    return path;
  }

  verifyURLStatus(params: any) {
    const managementState: any = this.status.getState('management');
    const op = params['op'];
    const userId = params['user'];

    if (!op && !userId) {
      const storedRoute = managementState?.url_route;
      if (
        Array.isArray(storedRoute) &&
        ['u', 't'].includes(storedRoute[1]) &&
        storedRoute[2]
      ) {
      this.router.navigate(
          storedRoute,
          {
          queryParams: managementState.url_query_params,
            replaceUrl: true,
          }
        );
      } else {
      this.goDefaultRoute();
      }
      return;
    }

    if (!['u', 't'].includes(op) || !/^[a-f\d]{24}$/i.test(String(userId || ''))) {
      this.status.removeState('management');
      this.goDefaultRoute();
      return;
    }

    this.op = op;
    this.currentUserId = userId;
    this.setURLStatus();
  }

  goDefaultRoute() {
    const currentUser = this.authService.getCurrentUser();
    const currentUserId = currentUser?.id || (currentUser as any)?._id;
    if (currentUserId) {
      this.router.navigate(['admin/management', 'u', currentUserId], { replaceUrl: true });
    } else {
      this.router.navigate(['auth/login']);
    }
  }

  searchUser() {
    this.setOp('u', this.currentUserId);
  }

  searchTargets() {
    this.setOp('t', this.currentUserId);
  }

  setCurrentUserId(userId: string) {
    if (userId) {
      this.currentUserId = userId;
    }
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
