// src/app/app-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { PublicGuard } from './core/guards/public.guard';
import { RedirectComponent } from './core/components/redirect/redirect.component';

const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./auth/presentation/auth.module').then(m => m.AuthModule),
    canActivate: [PublicGuard]
  },
  {
    path: 'realtimelink',
    loadChildren: () => import('./realtimelink/realtimelink.module').then(m => m.RealtimelinkModule)
  },
  {
    path: 'registro',
    loadChildren: () => import('./public-registration/public-registration.module').then(m => m.PublicRegistrationModule)
  },
  {
    path: 'admin',
    redirectTo: '/admin/management',
    pathMatch: 'full'
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/presentation/admin.module').then(m => m.AdminModule),
    canActivate: [AuthGuard]
  },
  {
    path: '',
    redirectTo: '/admin/management',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/admin/management'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
