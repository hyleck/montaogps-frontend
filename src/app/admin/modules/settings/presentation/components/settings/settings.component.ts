import { Component, OnInit } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { StatusService } from '@shared/services/status.service';

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
    SystemSettingsDisplay: boolean = false;
    ServersSettingsDisplay: boolean = false;
    PlansSettingsDisplay: boolean = false;
    ColorsSettingsDisplay: boolean = false;
    VehicleBrandsSettingsDisplay: boolean = false;
    VehicleModelsSettingsDisplay: boolean = false;

    settingsCards = [
        {
            titleKey: 'settings.system.title',
            icon: 'pi pi-cog',
            action: () => this.SystemSettingsDisplay = true,
            descriptionKey: 'settings.system.description'
        },
        {
            titleKey: 'settings.roles.title',
            icon: 'pi pi-users',
            action: () => this.RolesFormDisplay = true,
            descriptionKey: 'settings.roles.description'
        },
        {
            icon: 'pi pi-server',
            titleKey: 'settings.cards.servers.title',
            descriptionKey: 'settings.cards.servers.description',
            action: () => this.ServersSettingsDisplay = true
        },
        {
            icon: 'pi pi-list',
            titleKey: 'settings.cards.plans.title',
            descriptionKey: 'settings.cards.plans.description',
            action: () => this.PlansSettingsDisplay = true
        },
        {
            titleKey: 'settings.colors.title',
            icon: 'pi pi-palette',
            action: () => this.ColorsSettingsDisplay = true,
            descriptionKey: 'settings.colors.description'
        },
        {
            titleKey: 'settings.sectors.title',
            icon: 'pi pi-map',
            route: '/admin/settings/sectors',
            descriptionKey: 'settings.sectors.description',
            disabled: true
        },
        {
            titleKey: 'settings.tags.title',
            icon: 'pi pi-tags',
            route: '/admin/settings/tags',
            descriptionKey: 'settings.tags.description',
            disabled: true
        },
        {
            titleKey: 'settings.brands.title',
            icon: 'pi pi-car',
            action: () => this.VehicleBrandsSettingsDisplay = true,
            descriptionKey: 'settings.brands.description'
        },
        {
            titleKey: 'settings.models.title',
            icon: 'pi pi-truck',
            action: () => this.VehicleModelsSettingsDisplay = true,
            descriptionKey: 'settings.models.description',
            disabled: false
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
