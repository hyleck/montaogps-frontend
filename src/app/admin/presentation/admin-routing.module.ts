import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from './components/admin-layout/admin.component';
import { RootGuard } from '../../core/guards/root.guard';

const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('../modules/dashboard/presentation/dashboard.module').then(m => m.DashboardModule)
      },
      {
        path: 'metrics',
        canActivate: [RootGuard],
        loadChildren: () => import('../modules/metrics/presentation/metrics.module').then(m => m.MetricsModule)
      },
      {
        path: 'anomalies',
        canActivate: [RootGuard],
        loadChildren: () => import('../modules/anomalies/presentation/anomalies.module').then(m => m.AnomaliesModule)
      },
      {
        path: 'reports',
        loadChildren: () => import('../modules/reports/presentation/reports.module').then(m => m.ReportsModule)
      },
      {
        path: 'inventory',
        loadChildren: () => import('../modules/inventory/presentation/inventory.module').then(m => m.InventoryModule)
      },
      {
        path: 'macro',
        loadChildren: () => import('../modules/macro/presentation/macro.module').then(m => m.MacroModule)
      },
      {
        path: 'follow-up',
        loadChildren: () => import('../modules/follow-up/presentation/follow-up.module').then(m => m.FollowUpModule)
      },
      {
        path: 'management',
        loadChildren: () => import('../modules/management/presentation/management.module').then(m => m.ManagementModule)
      },
      {
        path: 'settings',
        loadChildren: () => import('../modules/settings/presentation/settings.module').then(m => m.SettingsModule)
      },
      {
        path: 'profile',
        loadChildren: () => import('../modules/profile/presentation/profile.module').then(m => m.ProfileModule)
      },
      {
        path: 'monitoring',
        loadChildren: () => import('../modules/monitoring/presentation/monitoring.module').then(m => m.MonitoringModule)
      },
      {
        path: 'server-costs',
        loadChildren: () => import('../modules/server-costs/presentation/server-costs.module').then(m => m.ServerCostsModule)
      },
      {
        path: 'solicitudes',
        loadChildren: () => import('../modules/solicitudes/presentation/solicitudes.module').then(m => m.SolicitudesModule)
      },
      {
        path: 'communication',
        loadChildren: () => import('../modules/communication/presentation/communication.module').then(m => m.CommunicationModule)
      },
      {
        path: 'ester',
        canActivate: [RootGuard],
        loadChildren: () => import('../modules/ester/presentation/ester.module').then(m => m.EsterModule)
      },
      {
        path: 'processes',
        loadChildren: () => import('../modules/processes/presentation/processes.module').then(m => m.ProcessesModule)
      },
      {
        path: 'interacciones',
        loadChildren: () => import('../modules/interacciones/presentation/interacciones.module').then(m => m.InteraccionesModule)
      },
      {
        path: 'empleados',
        loadChildren: () => import('../modules/empleados/presentation/empleados.module').then(m => m.EmpleadosModule)
      },
      {
        path: 'simcard-verification',
        loadChildren: () => import('../modules/simcard-verification/simcard-verification.module').then(m => m.SimcardVerificationModule)
      },
      {
        path: 'monitor-ia',
        canMatch: [RootGuard],
        canActivate: [RootGuard],
        loadChildren: () => import('../modules/monitor-ia/presentation/monitor-ia.module').then(m => m.MonitorIaModule)
      },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
