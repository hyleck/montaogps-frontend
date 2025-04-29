import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimengModule } from '@shared/libraries/primeng/primeng.module';
import { SettingsRoutingModule } from './settings-routing.module';
import { SettingsComponent } from './components/settings/settings.component';
import { UserRolesSettingsComponent } from './components/settings/user-roles-settings/user-roles-settings.component';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  declarations: [
    SettingsComponent,
    UserRolesSettingsComponent
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
