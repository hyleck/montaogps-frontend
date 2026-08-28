import { DeviceLabelInputDirective } from 'src/app/shareds/directives/device-label-input.directive';
import { DeviceLabelPipe } from 'src/app/shareds/pipes/device-label.pipe';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimengModule } from '@shared/libraries/primeng/primeng.module';
import { InputSwitchModule } from 'primeng/inputswitch';
import { CloudModule } from '../../../../shareds/components/cloud/cloud.module';
import { SettingsRoutingModule } from './settings-routing.module';
import { SettingsComponent } from './components/settings/settings.component';
import { UserRolesSettingsComponent } from './components/settings/user-roles-settings/user-roles-settings.component';
import { TranslateModule } from '@ngx-translate/core';
import { SystemSettingsComponent } from './components/settings/system-settings/system-settings.component';
import { ServersSettingsComponent } from './components/settings/servers-settings/servers-settings.component';
import { ColorsSettingsComponent } from './components/settings/colors-settings/colors-settings.component';
import { VehicleBrandsSettingsComponent } from './components/settings/vehicle-brands-settings/vehicle-brands-settings.component';
import { VehicleModelsSettingsComponent } from './components/settings/vehicle-models-settings/vehicle-models-settings.component';
import { ProtocolsSettingsComponent } from './components/settings/protocols-settings/protocols-settings.component';
import { HistorialesSettingsComponent } from './components/settings/historiales-settings/historiales-settings.component';
import { SectorsSettingsComponent } from './components/settings/sectors-settings/sectors-settings.component';
import { SupportSettingsComponent } from './components/settings/support-settings/support-settings.component';
import { TagsSettingsComponent } from './components/settings/tags-settings/tags-settings.component';
import { CustomizerSettingsComponent } from './components/settings/customizer-settings/customizer-settings.component';
import { PushManagerSettingsComponent } from './components/settings/push-manager-settings/push-manager-settings.component';
import { MembresiasSettingsComponent } from './components/settings/membresias-settings/membresias-settings.component';

@NgModule({
  declarations: [
    SettingsComponent,
    UserRolesSettingsComponent,
    SystemSettingsComponent,
    ServersSettingsComponent,
    ColorsSettingsComponent,
    VehicleBrandsSettingsComponent,
    VehicleModelsSettingsComponent,
    ProtocolsSettingsComponent,
    HistorialesSettingsComponent,
    SectorsSettingsComponent,
    SupportSettingsComponent,
    PushManagerSettingsComponent
  ],
  imports: [
    DeviceLabelInputDirective,
    DeviceLabelPipe,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimengModule,
    InputSwitchModule,
    SettingsRoutingModule,
    TranslateModule,
    TagsSettingsComponent,
    CustomizerSettingsComponent,
    MembresiasSettingsComponent,
    CloudModule
  ]
})
export class SettingsModule { }
