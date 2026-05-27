// src/app/auth/application/auth-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { SsoLoginComponent } from './components/sso-login/sso-login.component';


const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'sso', component: SsoLoginComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthRoutingModule { }
