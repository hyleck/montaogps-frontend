import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AdminRoutingModule } from './admin-routing.module';
import { AdminComponent } from './components/admin-layout/admin.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { MapAlertComponent } from './components/map-alert/map-alert.component';
import { PrimengModule } from '../../shareds/libraries/primeng/primeng.module';
import { TranslateModule } from '@ngx-translate/core';
import { CloudModule } from '../../shareds/components/cloud/cloud.module';

@NgModule({
  declarations: [
    AdminComponent,
    NavbarComponent,
    SidebarComponent,
    MapAlertComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    AdminRoutingModule,
    PrimengModule,
    TranslateModule,
    CloudModule,
    RouterModule
  ]
})
export class AdminModule { }
