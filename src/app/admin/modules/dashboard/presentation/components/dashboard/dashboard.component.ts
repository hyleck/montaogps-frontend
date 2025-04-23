import { Component, OnInit } from '@angular/core';
import { MenuItem } from 'primeng/api';

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
    items: MenuItem[] = [{ label: 'Dashboard' }];
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

    ngOnInit() {
        this.loadDashboardStats();
        this.initializeChart();
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
                    label: 'Dispositivos Instalados',
                    backgroundColor: documentStyle.getPropertyValue('--dashboardStatusOnline'),
                    data: [65, 59, 80, 81, 56, 55, 40, 45, 58, 62, 75, 80]
                },
                {
                    label: 'Dispositivos Cancelados',
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
