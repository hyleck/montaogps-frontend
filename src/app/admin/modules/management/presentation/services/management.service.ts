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
    
    this.op = op;
    
    if (userId) {
      this.currentUserId = userId;
    } else if (!this.currentUserId) {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        this.currentUserId = currentUser.id;
      }
    }
    
    // Solo navegar si cambió el usuario o es la primera vez que se establece la operación
    const userChanged = previousUserId !== this.currentUserId;
    const isFirstTime = !previousOp;
    
    if (userChanged || isFirstTime) {
      
      const searchTerms: { [key: string]: string | undefined } = {
        u: this.searchUsersTerm,
        t: this.searchTargetsTerm
      };
      const searchParam = searchTerms[op];

      this.router.navigate(
        ['admin/management', op, this.currentUserId],
        { 
          queryParams: { search: searchParam },
          queryParamsHandling: 'merge' // Preservar otros query params como 'target'
        }
      ).then(() => {
        this.setURLStatus();
      });
    } else {
      
      // Solo actualizar la URL sin navegar completamente
      const searchTerms: { [key: string]: string | undefined } = {
        u: this.searchUsersTerm,
        t: this.searchTargetsTerm
      };
      const searchParam = searchTerms[op];
      
      this.router.navigate(
        ['admin/management', op, this.currentUserId],
        { 
          queryParams: { search: searchParam },
          queryParamsHandling: 'merge', // Preservar otros query params como 'target'
          replaceUrl: true  // Reemplazar la URL actual sin agregar al historial
        }
      ).then(() => {
        this.setURLStatus();
      });
    }
  }

  setURLStatus() {
    // Obtener query params actuales para preservarlos
    const currentQueryParams = this.router.routerState.root.firstChild?.snapshot.queryParams || {};
    
    // Preparar los nuevos query params manteniendo los existentes
    const newQueryParams: any = {
      ...currentQueryParams // Preservar parámetros existentes como 'target'
    };
    
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
    const previousUserId = this.currentUserId;
    
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
        { 
          queryParams: managementState.url_query_params,
          queryParamsHandling: 'merge' // Preservar otros query params como 'target'
        }
      );
    } else if ((!managementState.url_route || !managementState.url_route[1]) && !params['op'] && !params['user']) {
      this.goDefaultRoute();
    }

    // Solo cargar datos del usuario si cambió o no estaba cargado
    if (this.currentUserId && (previousUserId !== this.currentUserId || !this.selectedUser)) {
      this.loadUserData(this.currentUserId);
    } else if (this.currentUserId) {
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
      { 
        queryParams: { search: this.searchUsersTerm },
        queryParamsHandling: 'merge' // Preservar otros query params como 'target'
      }
    );
    this.setURLStatus();
  }

  searchTargets() {
    this.router.navigate(
      ['admin/management', this.op, this.currentUserId],
      { 
        queryParams: { search: this.searchTargetsTerm },
        queryParamsHandling: 'merge' // Preservar otros query params como 'target'
      }
    );
    this.setURLStatus();
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
