import { Component, OnInit, OnDestroy } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { StatusService } from '@shared/services/status.service';
import { HistorialesService } from '@core/services/historiales.service';
import { AuthService } from '@core/services/auth.service';
import { interval, Subscription } from 'rxjs';

@Component({
    selector: 'app-settings',
    templateUrl: './settings.component.html',
    styleUrl: './settings.component.css',
    standalone: false
})
export class SettingsComponent implements OnInit, OnDestroy {
    items: MenuItem[] = [];
    home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };
    RolesFormDisplay: boolean = false;
    SystemSettingsDisplay: boolean = false;
    ServersSettingsDisplay: boolean = false;
    PlansSettingsDisplay: boolean = false;
    ColorsSettingsDisplay: boolean = false;
    VehicleBrandsSettingsDisplay: boolean = false;
    VehicleModelsSettingsDisplay: boolean = false;
    ProtocolsSettingsDisplay: boolean = false;
    HistorialesSettingsDisplay: boolean = false;
    SectorsSettingsDisplay: boolean = false;
    SupportSettingsDisplay: boolean = false;
    CustomizerSettingsDisplay: boolean = false;
    TagsSettingsDisplay: boolean = false;

    // Estado del análisis de historiales
    isHistorialesAnalysisRunning: boolean = false;
    historialStatusSubscription: Subscription | null = null;

    settingsCards: {
        titleKey: string;
        icon: string;
        action?: () => void;
        route?: string;
        descriptionKey: string;
        disabled?: boolean;
    }[] = [
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
                action: () => this.SectorsSettingsDisplay = true,
                descriptionKey: 'settings.sectors.description'
            },
            {
                titleKey: 'settings.tags.title',
                icon: 'pi pi-tags',
                action: () => this.TagsSettingsDisplay = true,
                descriptionKey: 'settings.tags.description',
                disabled: false
            },
            {
                titleKey: 'settings.protocols.title',
                icon: 'pi pi-shield',
                action: () => this.ProtocolsSettingsDisplay = true,
                descriptionKey: 'settings.protocols.description',
                disabled: false
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
            },
            {
                titleKey: 'settings.historiales.title',
                icon: 'pi pi-history',
                action: () => this.HistorialesSettingsDisplay = true,
                descriptionKey: 'settings.historiales.description'
            },
            {
                titleKey: 'settings.support.title',
                icon: 'pi pi-question-circle',
                action: () => this.SupportSettingsDisplay = true,
                descriptionKey: 'settings.support.description'
            },
            {
                titleKey: 'settings.customizer.title',
                icon: 'pi pi-code',
                descriptionKey: 'settings.customizer.description',
                action: () => this.CustomizerSettingsDisplay = true
            }

        ];

    constructor(
        private router: Router,
        private translate: TranslateService,
        private statusService: StatusService,
        private historialesService: HistorialesService,
        private authService: AuthService
    ) {
        this.initializeBreadcrumb();
    }

    ngOnInit() {
        // Actualizar breadcrumb cuando cambie el idioma
        this.translate.onLangChange.subscribe(() => {
            this.initializeBreadcrumb();
        });

        // Iniciar monitoreo del estado de historiales
        this.startHistorialesStatusMonitoring();
    }

    // Método para verificar si tiene algún permiso en plans
    hasAnyPlanPermission(): boolean {
        return this.authService.hasPrivilege('plans', 'create') ||
            this.authService.hasPrivilege('plans', 'read') ||
            this.authService.hasPrivilege('plans', 'update') ||
            this.authService.hasPrivilege('plans', 'delete');
    }

    // Método para verificar si tiene algún permiso en system
    hasAnySystemPermission(): boolean {
        return this.authService.hasPrivilege('system', 'create') ||
            this.authService.hasPrivilege('system', 'read') ||
            this.authService.hasPrivilege('system', 'update') ||
            this.authService.hasPrivilege('system', 'delete');
    }

    // Método para verificar si tiene algún permiso en colors
    hasAnyColorPermission(): boolean {
        return this.authService.hasPrivilege('colors', 'create') ||
            this.authService.hasPrivilege('colors', 'read') ||
            this.authService.hasPrivilege('colors', 'update') ||
            this.authService.hasPrivilege('colors', 'delete');
    }

    // Método para verificar si tiene algún permiso en servers
    hasAnyServerPermission(): boolean {
        return this.authService.hasPrivilege('servers', 'create') ||
            this.authService.hasPrivilege('servers', 'read') ||
            this.authService.hasPrivilege('servers', 'update') ||
            this.authService.hasPrivilege('servers', 'delete');
    }

    // Método para verificar si tiene algún permiso en sectors
    hasAnySectorPermission(): boolean {
        return this.authService.hasPrivilege('sectors', 'create') ||
            this.authService.hasPrivilege('sectors', 'read') ||
            this.authService.hasPrivilege('sectors', 'update') ||
            this.authService.hasPrivilege('sectors', 'delete');
    }

    // Método para verificar si tiene algún permiso en protocols
    hasAnyProtocolPermission(): boolean {
        return this.authService.hasPrivilege('protocols', 'create') ||
            this.authService.hasPrivilege('protocols', 'read') ||
            this.authService.hasPrivilege('protocols', 'update') ||
            this.authService.hasPrivilege('protocols', 'delete');
    }

    // Método para verificar si tiene algún permiso en brands
    hasAnyBrandPermission(): boolean {
        return this.authService.hasPrivilege('brands', 'create') ||
            this.authService.hasPrivilege('brands', 'read') ||
            this.authService.hasPrivilege('brands', 'update') ||
            this.authService.hasPrivilege('brands', 'delete');
    }

    // Método para verificar si tiene algún permiso en models
    hasAnyModelPermission(): boolean {
        return this.authService.hasPrivilege('models', 'create') ||
            this.authService.hasPrivilege('models', 'read') ||
            this.authService.hasPrivilege('models', 'update') ||
            this.authService.hasPrivilege('models', 'delete');
    }

    // Método para verificar si el usuario es root
    isRootUser(): boolean {
        const currentUser = this.authService.getCurrentUser();
        return currentUser?.root === true || (currentUser?.root as any) === 'true';
    }

    // Método para verificar si tiene algún permiso en roles
    hasAnyRolePermission(): boolean {
        return this.authService.hasPrivilege('roles', 'create') ||
            this.authService.hasPrivilege('roles', 'read') ||
            this.authService.hasPrivilege('roles', 'update') ||
            this.authService.hasPrivilege('roles', 'delete');
    }

    // Getter para obtener las tarjetas filtradas según permisos
    get filteredSettingsCards() {
        return this.settingsCards.filter(card => {
            // Si es la tarjeta de roles, verificar permisos
            if (card.titleKey === 'settings.roles.title') {
                return this.hasAnyRolePermission();
            }
            // Si es la tarjeta de plans, verificar permisos
            if (card.titleKey === 'settings.cards.plans.title') {
                return this.hasAnyPlanPermission();
            }
            // Si es la tarjeta de system, verificar permisos
            if (card.titleKey === 'settings.system.title') {
                return this.hasAnySystemPermission();
            }
            // Si es la tarjeta de colors, verificar permisos
            if (card.titleKey === 'settings.colors.title') {
                return this.hasAnyColorPermission();
            }
            // Si es la tarjeta de servers, verificar permisos
            if (card.titleKey === 'settings.cards.servers.title') {
                return this.hasAnyServerPermission();
            }
            // Si es la tarjeta de sectors, verificar permisos
            if (card.titleKey === 'settings.sectors.title') {
                return this.hasAnySectorPermission();
            }
            // Si es la tarjeta de protocols, verificar permisos
            if (card.titleKey === 'settings.protocols.title') {
                return this.hasAnyProtocolPermission();
            }
            // Si es la tarjeta de brands, verificar permisos
            if (card.titleKey === 'settings.brands.title') {
                return this.hasAnyBrandPermission();
            }
            // Si es la tarjeta de models, verificar permisos
            if (card.titleKey === 'settings.models.title') {
                return this.hasAnyModelPermission();
            }
            // Si es la tarjeta de historiales, verificar que sea usuario root
            if (card.titleKey === 'settings.historiales.title') {
                return this.isRootUser();
            }
            // Para otras tarjetas, mostrar siempre (por ahora)
            return true;
        });
    }

    ngOnDestroy(): void {
        this.stopHistorialesStatusMonitoring();
    }

    /**
     * Iniciar monitoreo del estado de análisis de historiales
     */
    private startHistorialesStatusMonitoring(): void {
        // Verificar inmediatamente
        this.checkHistorialesStatus();

        // Verificar cada 5 segundos
        this.historialStatusSubscription = interval(5000).subscribe(() => {
            this.checkHistorialesStatus();
        });
    }

    /**
     * Detener monitoreo del estado de análisis
     */
    private stopHistorialesStatusMonitoring(): void {
        if (this.historialStatusSubscription) {
            this.historialStatusSubscription.unsubscribe();
            this.historialStatusSubscription = null;
        }
    }

    /**
     * Verificar si hay un análisis de historiales en progreso
     */
    private checkHistorialesStatus(): void {
        this.historialesService.getCurrentProgress().subscribe({
            next: (response) => {
                if (response.success && response.progress) {
                    // Hay un análisis activo si el estado es 'running'
                    this.isHistorialesAnalysisRunning = response.progress.status === 'running';
                } else {
                    // No hay análisis en progreso
                    this.isHistorialesAnalysisRunning = false;
                }
            },
            error: () => {
                // No hay análisis en progreso o error de conexión
                this.isHistorialesAnalysisRunning = false;
            }
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

    navigateTo(route: string | undefined, action: Function | undefined) {
        if (route) {
            this.router.navigate([route]);
        } else if (action) {
            action();
        }
    }

    /**
     * Verificar si es la tarjeta de historiales
     */
    isHistorialesCard(card: any): boolean {
        return card.titleKey === 'settings.historiales.title';
    }
}
