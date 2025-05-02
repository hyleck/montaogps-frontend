import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimengModule } from '@shared/libraries/primeng/primeng.module';
import { SettingsRoutingModule } from './settings-routing.module';
import { SettingsComponent } from './components/settings/settings.component';
import { UserRolesSettingsComponent } from './components/settings/user-roles-settings/user-roles-settings.component';
import { TranslateModule } from '@ngx-translate/core';
import { SystemSettingsComponent } from './components/settings/system-settings/system-settings.component';

@NgModule({
  declarations: [
    SettingsComponent,
    UserRolesSettingsComponent,
    SystemSettingsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    PrimengModule,
    SettingsRoutingModule,
    TranslateModule
  ]
})
export class SettingsModule { }
