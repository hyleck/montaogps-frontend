import { Injectable } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { ManagementService } from './management.service';

export interface BreadcrumbItem {
  id: string;
  fullName: string;
  profile_type_id?: string;
}

export interface BreadcrumbViewer {
  id?: string;
  _id?: string;
  root?: boolean | string;
  developer?: boolean | string;
  affiliation_type_id?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BreadcrumbService {
  private items: MenuItem[] = [];
  private path: BreadcrumbItem[] = [];
  private home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

  constructor(private managementService: ManagementService) {}

  /**
   * Actualiza el breadcrumb desde los datos del path del usuario
   */
  updateFromUserPath(
    pathData: BreadcrumbItem[],
    currentUser?: { name: string; last_name: string },
    viewer?: BreadcrumbViewer | null,
  ): MenuItem[] {
    if (!pathData || !Array.isArray(pathData) || pathData.length === 0) {
      // Si no hay datos de path, usar solo el usuario actual
      if (currentUser) {
        this.path = [];
        this.items = [
          { label: `${currentUser.name} ${currentUser.last_name}` }
        ];
      } else {
        this.path = [];
        this.items = [];
      }
      return this.items;
    }

    const safePath = this.limitPathForViewer(pathData, viewer);
    this.path = [...safePath];

    // Convertir los datos del path en elementos del breadcrumb
    this.items = safePath.map((pathItem, index) => {
      const isLast = index === safePath.length - 1;
      
      return {
        label: pathItem.fullName,
        // Para elementos que no son el último, agregar comando para navegar
        command: !isLast ? () => {
          this.navigateToUser(pathItem.id);
        } : undefined,
        // Solo el último elemento no será clickeable
        disabled: isLast
      };
    });

    return this.items;
  }

  private limitPathForViewer(
    pathData: BreadcrumbItem[],
    viewer?: BreadcrumbViewer | null,
  ): BreadcrumbItem[] {
    if (!viewer) return [...pathData];

    const viewerId = String(viewer.id || viewer._id || '').trim();
    const viewerIndex = pathData.findIndex((segment) => segment.id === viewerId);
    if (viewerIndex >= 0) return pathData.slice(viewerIndex);

    const affiliation = String(viewer.affiliation_type_id || '').toLowerCase();
    if (affiliation === 'empleado' || affiliation === 'tecnico_empleado') {
      let sharedIndex = -1;
      pathData.forEach((segment, index) => {
        if (String(segment.profile_type_id || '').toLowerCase() === 'compartido') {
          sharedIndex = index;
        }
      });
      if (sharedIndex >= 0) return pathData.slice(sharedIndex);
    }

    return [pathData[pathData.length - 1]];
  }

  /**
   * Establece un breadcrumb simple con un solo elemento
   */
  setSingleItem(label: string): MenuItem[] {
    this.path = [];
    this.items = [{ label }];
    return this.items;
  }

  /**
   * Navega a un usuario específico
   */
  private navigateToUser(userId: string): void {
    this.managementService.setOp('u', userId);
  }

  /**
   * Verifica si se puede navegar hacia atrás en la jerarquía
   */
  canNavigateBack(_managementState?: any): boolean {
    return this.path.length > 1;
  }

  /**
   * Navega al usuario padre en la jerarquía
   */
  navigateToParent(_managementState?: any): void {
    if (this.path.length <= 1) return;
    const parent = this.path[this.path.length - 2];
    this.managementService.setOp('u', parent.id);
  }

  /**
   * Obtiene los items del breadcrumb actuales
   */
  getItems(): MenuItem[] {
    return [...this.items];
  }

  /**
   * Obtiene el item home del breadcrumb
   */
  getHome(): MenuItem {
    return { ...this.home };
  }

  /**
   * Establece un item home personalizado
   */
  setHome(home: MenuItem): void {
    this.home = { ...home };
  }

  /**
   * Limpia el breadcrumb
   */
  clear(): void {
    this.items = [];
    this.path = [];
  }

  /**
   * Agrega un item al final del breadcrumb
   */
  addItem(item: MenuItem): void {
    this.items.push(item);
  }

  /**
   * Elimina el último item del breadcrumb
   */
  removeLastItem(): void {
    this.items.pop();
  }
}
