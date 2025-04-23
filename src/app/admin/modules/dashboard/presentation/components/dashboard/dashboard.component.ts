import { Component, OnInit } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { LangService } from '../../../../../../shareds/services/langi18/lang.service';
import { TranslateService } from '@ngx-translate/core';

interface DashboardStats {
    online: number;
    active: number;
    offline: number;
    suspended: number;
    expired: number;
    canceled: number;
    total: number;
}

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.css',
    standalone: false
})
export class DashboardComponent implements OnInit {
    items: MenuItem[] = [];
    home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

    stats: DashboardStats = {
        online: 1862,
        active: 2810,
        offline: 948,
        suspended: 821,
        expired: 1423,
        canceled: 1779,
        total: 6339
    };

    // Datos del gráfico
    deviceChartData: any;
    deviceChartOptions: any;

    constructor(
        public langService: LangService,
        private translate: TranslateService
    ) {
        this.initializeBreadcrumb();
    }

    ngOnInit() {
        this.loadDashboardStats();
        this.initializeChart();
        
        // Actualizar breadcrumb cuando cambie el idioma
        this.translate.onLangChange.subscribe(() => {
            this.initializeBreadcrumb();
        });
    }

    private initializeBreadcrumb() {
        this.items = [{
            label: this.translate.instant('breadcrumb.dashboard.title'),
            routerLink: '/admin/dashboard'
        }];
        this.home = {
            icon: 'pi pi-home',
            routerLink: '/admin/dashboard'
        };
    }

    private loadDashboardStats() {
        // TODO: Implementar la carga de datos desde el servicio
    }

    private initializeChart() {
        const documentStyle = getComputedStyle(document.documentElement);

        this.deviceChartData = {
            labels: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
            datasets: [
                {
                    label: this.translate.instant('dashboard.installedDevices'),
                    backgroundColor: documentStyle.getPropertyValue('--dashboardStatusOnline'),
                    data: [65, 59, 80, 81, 56, 55, 40, 45, 58, 62, 75, 80]
                },
                {
                    label: this.translate.instant('dashboard.canceledDevices'),
                    backgroundColor: documentStyle.getPropertyValue('--dashboardStatusExpired'),
                    data: [28, 48, 40, 19, 86, 27, 90, 35, 42, 25, 30, 45]
                }
            ]
        };

        this.deviceChartOptions = {
            plugins: {
                legend: {
                    labels: {
                        color: documentStyle.getPropertyValue('--dashboardTextPrimary')
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: documentStyle.getPropertyValue('--dashboardTextSecondary')
                    },
                    grid: {
                        color: documentStyle.getPropertyValue('--dashboardCardBorder')
                    }
                },
                x: {
                    ticks: {
                        color: documentStyle.getPropertyValue('--dashboardTextSecondary')
                    },
                    grid: {
                        color: documentStyle.getPropertyValue('--dashboardCardBorder')
                    }
                }
            }
        };
    }
}
