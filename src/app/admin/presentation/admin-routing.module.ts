import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from './components/admin-layout/admin.component';

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
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
