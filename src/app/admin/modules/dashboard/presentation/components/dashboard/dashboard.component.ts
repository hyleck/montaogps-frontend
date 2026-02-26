import { Component, OnDestroy, OnInit } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { LangService } from '../../../../../../shareds/services/langi18/lang.service';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin, Subscription } from 'rxjs';
import { TargetsService } from '../../../../../../core/services/targets.service';
import { UserService } from '../../../../../../core/services/user.service';
import { InventoryService } from '../../../../../../core/services/inventory.service';
import { AuthService } from '../../../../../../core/services/auth.service';
import { MonitoringService, MonitoringSummary } from '../../../../../../core/services/monitoring.service';
import { ProcessService, ProcessStatsResponse, CreatorStatsResponse, CreatorStat } from '../../../../../../core/services/process.service';

import { Router } from '@angular/router';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.css',
    standalone: false
})
export class DashboardComponent implements OnInit, OnDestroy {
    items: MenuItem[] = [];
    home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

    isLoading: boolean = false;
    isMonitoringLoading: boolean = false;
    monitoringStats: MonitoringSummary | null = null;

    isProcessLoading: boolean = false;
    processCards: { icon: string; title: string; count: number; colorClass: string }[] = [];

    isCreatorStatsLoading: boolean = false;
    creatorStats: CreatorStat[] = [];

    private subscription: Subscription = new Subscription();

    constructor(
        public langService: LangService,
        private translate: TranslateService,
        private targetsService: TargetsService,
        private userService: UserService,
        private inventoryService: InventoryService,
        private authService: AuthService,
        private monitoringService: MonitoringService,
        private processService: ProcessService,
        private router: Router
    ) {
        this.initializeBreadcrumb();
    }

    ngOnInit() {
        // Guard to prevent non-employees from accessing the Dashboard directly via URL
        const currentUser = this.authService.getCurrentUser();
        const isEmployee = currentUser?.affiliation_type_id === 'empleado';
        const isRoot = currentUser?.root === true;

        if (!isEmployee && !isRoot) {
            this.router.navigate(['/admin/management']);
            return;
        }

        this.loadMonitoringData();
        this.loadProcessData();
        this.loadCreatorStats();

        // Actualizar breadcrumb cuando cambie el idioma
        this.subscription.add(
            this.translate.onLangChange.subscribe(() => {
                this.initializeBreadcrumb();
            })
        );
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
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

    private loadMonitoringData() {
        const targetUserId = '68a9ccf19bb280482272477f';
        this.isMonitoringLoading = true;

        this.subscription.add(
            this.monitoringService.monitorUserSummary(targetUserId).subscribe({
                next: (res) => {
                    if (res && res.summaries && res.summaries.length > 0) {
                        // The backend likely returns them sorted by latest first, or we can just take the first one
                        this.monitoringStats = res.summaries[0];
                    }
                    this.isMonitoringLoading = false;
                },
                error: (err) => {
                    console.error('Error fetching monitoring summary', err);
                    this.isMonitoringLoading = false;
                }
            })
        );
    }

    private getProcessName(typeId: number): string {
        // En management.component.ts `type: 8` se usa para la Cancelación de Dispositivos.
        // En target-form.component.ts `type: 8` se mapeaba a 'technician_change'.
        // Asignaré ambos de manera condicional o separada asumiendo la lista.
        // Dado que el backend depende solo del tipo numérico, documentaremos todos los tipos:
        const processNames: Record<number, string> = {
            1: 'Instalación',
            2: 'Edición F. Instalación',
            3: 'Edición F. Expiración',
            4: 'Renovación de Servicio',
            5: 'Cambio de Plan',
            6: 'Suspensión', // En caso de que se use
            7: 'Reactivación',
            8: 'Cancelación / Cmb. Técnico', // Mismo ID en el código de target-form y management
            9: 'Cambio de GPS',
            10: 'Edición Detalles Instalación',
            11: 'Cambio Modelo GPS',
            12: 'Edición IMEI / GPS ID',
            13: 'Cambio de SIM Card',
            14: 'Edición Núm. SIM Card',
            15: 'Edición Tipo SIM Card',
            16: 'Restauración de Vehículo'
        };
        return processNames[typeId] || `Proceso Tipo ${typeId}`;
    }

    public getProcessNamePublic(typeId: number): string {
        return this.getProcessName(typeId);
    }

    private loadProcessData() {
        this.isProcessLoading = true;
        this.subscription.add(
            this.processService.getStats().subscribe({
                next: (res: ProcessStatsResponse) => {
                    const sortedProcesses = res.processesByType
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 10); // Display top 10 most common processes

                    const colorClasses = [
                        'primary', 'yellow', 'green', 'pink', 'cyan', 'orange', 'purple', 'teal', 'red', 'indigo'
                    ];

                    const defaultIcons: Record<number, string> = {
                        1: 'pi pi-wrench',
                        2: 'pi pi-calendar-plus',
                        3: 'pi pi-calendar-minus',
                        4: 'pi pi-sync',
                        5: 'pi pi-id-card',
                        6: 'pi pi-times-circle',
                        7: 'pi pi-check-circle',
                        8: 'pi pi-user-edit',
                        9: 'pi pi-desktop',
                        10: 'pi pi-file-edit',
                        11: 'pi pi-box',
                        12: 'pi pi-qrcode',
                        13: 'pi pi-credit-card',
                        14: 'pi pi-hashtag',
                        15: 'pi pi-globe',
                        16: 'pi pi-replay'
                    };

                    this.processCards = sortedProcesses.map((p, index) => {
                        return {
                            icon: defaultIcons[p._id] || 'pi pi-list',
                            title: this.getProcessName(p._id),
                            count: p.count,
                            colorClass: colorClasses[index % colorClasses.length]
                        };
                    });

                    this.isProcessLoading = false;
                },
                error: (err) => {
                    console.error('Error fetching process stats', err);
                    this.isProcessLoading = false;
                }
            })
        );
    }

    private toTitleCase(str: string): string {
        if (!str) return 'Sistema';
        return str.toLowerCase().split(' ').map(function (word) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
    }

    private loadCreatorStats() {
        this.isCreatorStatsLoading = true;
        this.subscription.add(
            this.processService.getStatsByCreator().subscribe({
                next: (res: CreatorStatsResponse) => {
                    console.log('Creator Stats received from backend:', res.statsByCreator);
                    this.creatorStats = res.statsByCreator.map(item => ({
                        ...item,
                        creatorName: this.toTitleCase(item.creatorName || item._id || 'Sistema'),
                        creatorEmail: item.creatorEmail || 'N/A'
                    }));
                    this.isCreatorStatsLoading = false;
                },
                error: (err) => {
                    console.error('Error fetching creator stats', err);
                    this.isCreatorStatsLoading = false;
                }
            })
        );
    }
}
