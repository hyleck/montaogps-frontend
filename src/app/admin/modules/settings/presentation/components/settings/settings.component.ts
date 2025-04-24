import { Component, OnInit } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-settings',
    templateUrl: './settings.component.html',
    styleUrl: './settings.component.css',
    standalone: false
})
export class SettingsComponent implements OnInit {
    items: MenuItem[] = [];
    home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };
    RolesFormDisplay: boolean = false;

    settingsCards = [
        {
            titleKey: 'settings.roles.title',
            icon: 'pi pi-users',
            action: () => this.RolesFormDisplay = true,
            descriptionKey: 'settings.roles.description'
        },
        {
            titleKey: 'settings.sectors.title',
            icon: 'pi pi-map',
            route: '/admin/settings/sectors',
            descriptionKey: 'settings.sectors.description'
        },
        {
            titleKey: 'settings.tags.title',
            icon: 'pi pi-tags',
            route: '/admin/settings/tags',
            descriptionKey: 'settings.tags.description'
        },
        {
            titleKey: 'settings.features.title',
            icon: 'pi pi-list',
            route: '/admin/settings/features',
            descriptionKey: 'settings.features.description'
        },
        {
            titleKey: 'settings.brands.title',
            icon: 'pi pi-car',
            route: '/admin/settings/brands',
            descriptionKey: 'settings.brands.description'
        },
        {
            titleKey: 'settings.models.title',
            icon: 'pi pi-truck',
            route: '/admin/settings/models',
            descriptionKey: 'settings.models.description'
        },
        {
            titleKey: 'settings.colors.title',
            icon: 'pi pi-palette',
            route: '/admin/settings/colors',
            descriptionKey: 'settings.colors.description'
        },
        {
            icon: 'pi pi-server',
            titleKey: 'settings.cards.servers.title',
            descriptionKey: 'settings.cards.servers.description',
            route: '/admin/settings/servers',
            action: undefined
        },
        {
            icon: 'pi pi-list',
            titleKey: 'settings.cards.plans.title',
            descriptionKey: 'settings.cards.plans.description',
            route: '/admin/settings/plans',
            action: undefined
        }
    ];

    constructor(
        private router: Router,
        private translate: TranslateService
    ) {
        this.initializeBreadcrumb();
    }

    ngOnInit() {
        // Actualizar breadcrumb cuando cambie el idioma
        this.translate.onLangChange.subscribe(() => {
            this.initializeBreadcrumb();
        });
    }

    private initializeBreadcrumb() {
        this.items = [{
            label: this.translate.instant('breadcrumb.settings.title'),
            routerLink: '/admin/settings'
        }];
        this.home = {
            icon: 'pi pi-home',
            routerLink: '/admin/dashboard'
        };
    }

    navigateTo(route: string | undefined, action?: () => void): void {
        if (action) {
            action();
            return;
        }
        if (route) {
            this.router.navigate([route]);
        }
    }
}
