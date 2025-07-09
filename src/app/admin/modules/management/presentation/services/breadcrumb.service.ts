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
  private home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

  constructor(private managementService: ManagementService) {}

  /**
   * Actualiza el breadcrumb desde los datos del path del usuario
   */
  updateFromUserPath(pathData: BreadcrumbItem[], currentUser?: { name: string; last_name: string }): MenuItem[] {
    if (!pathData || !Array.isArray(pathData) || pathData.length === 0) {
      // Si no hay datos de path, usar solo el usuario actual
      if (currentUser) {
        this.items = [
          { label: `${currentUser.name} ${currentUser.last_name}` }
        ];
      } else {
        this.items = [];
      }
      return this.items;
    }

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
  canNavigateBack(managementState: any): boolean {
    return managementState && managementState.url_route && managementState.url_route.length > 2;
  }

  /**
   * Navega al usuario padre en la jerarquía
   */
  navigateToParent(managementState: any): void {
    if (!managementState || !managementState.url_route || managementState.url_route.length === 0) {
      // Ir a la raíz por defecto
      this.managementService.setOp('u');
      return;
    }

    // Ir al nivel anterior en la jerarquía
    const parentRoute = managementState.url_route.slice(0, -2);
    
    if (parentRoute.length >= 2) {
      // Hay un usuario padre
      const parentUserId = parentRoute[parentRoute.length - 1];
      this.managementService.setOp('u', parentUserId);
    } else {
      // Ir a la raíz
      this.managementService.setOp('u');
    }
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