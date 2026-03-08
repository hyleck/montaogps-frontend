import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AdminRoutingModule } from './admin-routing.module';
import { AdminComponent } from './components/admin-layout/admin.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { MapAlertComponent } from './components/map-alert/map-alert.component';
import { PrimengCoreModule } from '../../shareds/libraries/primeng/primeng-core.module';
import { TranslateModule } from '@ngx-translate/core';
import { CloudModule } from '../../shareds/components/cloud/cloud.module';

@NgModule({
  declarations: [
    AdminComponent,
    NavbarComponent,
    SidebarComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    AdminRoutingModule,
    PrimengCoreModule,
    TranslateModule,
    CloudModule,
    RouterModule,
    MapAlertComponent
  ]
})
export class AdminModule { }
