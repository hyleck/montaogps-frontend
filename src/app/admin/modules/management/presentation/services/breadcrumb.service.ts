import { Injectable } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { ManagementService } from './management.service';

export interface BreadcrumbItem {
  id: string;
  fullName: string;
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
  updateFromUserPath(pathData: BreadcrumbItem[], currentUser?: { name: string; last_name: string }): MenuItem[] {
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

    this.path = [...pathData];

    // Convertir los datos del path en elementos del breadcrumb
    this.items = pathData.map((pathItem, index) => {
      const isLast = index === pathData.length - 1;
      
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
