import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AdminRoutingModule } from './admin-routing.module';
import { AdminComponent } from './components/admin-layout/admin.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { PrimengModule } from '../../shareds/libraries/primeng/primeng.module';



@NgModule({
  declarations: [
    AdminComponent,
    NavbarComponent,
    SidebarComponent
  ],
  imports: [
    CommonModule,
    AdminRoutingModule,
    PrimengModule
  ]
})
export class AdminModule { }
