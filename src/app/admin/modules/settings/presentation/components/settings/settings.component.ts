import { Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Router } from '@angular/router';

@Component({
    selector: 'app-settings',
    templateUrl: './settings.component.html',
    styleUrl: './settings.component.css',
    standalone: false
})
export class SettingsComponent {

    items: MenuItem[] = [{ label: 'Configuración' }];
    home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

    settingsCards = [
        {
            title: 'Roles',
            icon: 'pi pi-users',
            route: '/admin/settings/roles',
            description: 'Gestión de roles y permisos'
        },
        {
            title: 'Sectores',
            icon: 'pi pi-map',
            route: '/admin/settings/sectors',
            description: 'Configuración de sectores operativos'
        },
        {
            title: 'Etiquetas',
            icon: 'pi pi-tags',
            route: '/admin/settings/tags',
            description: 'Administración de etiquetas'
        },
        {
            title: 'Características',
            icon: 'pi pi-list',
            route: '/admin/settings/features',
            description: 'Gestión de características'
        },
        {
            title: 'Marcas',
            icon: 'pi pi-car',
            route: '/admin/settings/brands',
            description: 'Configuración de marcas'
        },
        {
            title: 'Modelos',
            icon: 'pi pi-truck',
            route: '/admin/settings/models',
            description: 'Gestión de modelos'
        },
        {
            title: 'Colores',
            icon: 'pi pi-palette',
            route: '/admin/settings/colors',
            description: 'Configuración de colores'
        }
    ];

    constructor(private router: Router) {}

    navigateTo(route: string): void {
        this.router.navigate([route]);
    }
}
