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
    ]
  } 
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
