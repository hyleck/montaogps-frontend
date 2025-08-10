import { Component, OnInit, OnDestroy } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { StatusService } from '@shared/services/status.service';
import { HistorialesService } from '@core/services/historiales.service';
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

    // Estado del análisis de historiales
    isHistorialesAnalysisRunning: boolean = false;
    historialStatusSubscription: Subscription | null = null;

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
            action: () => this.SectorsSettingsDisplay = true,
            descriptionKey: 'settings.sectors.description'
        },
        {
            titleKey: 'settings.tags.title',
            icon: 'pi pi-tags',
            route: '/admin/settings/tags',
            descriptionKey: 'settings.tags.description',
            disabled: true
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
        }
    ];

    constructor(
        private router: Router,
        private translate: TranslateService,
        private statusService: StatusService,
        private historialesService: HistorialesService
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
