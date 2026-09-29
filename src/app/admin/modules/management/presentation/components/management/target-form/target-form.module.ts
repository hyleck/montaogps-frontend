import { UserNamePipe } from 'src/app/shareds/pipes/user-name.pipe';
import { DeviceLabelInputDirective } from 'src/app/shareds/directives/device-label-input.directive';
import { DeviceLabelPipe } from 'src/app/shareds/pipes/device-label.pipe';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TargetFormComponent } from './target-form.component';
import { PrimengModule } from '../../../../../../../shareds/libraries/primeng/primeng.module';
import { FormsModule } from '@angular/forms';
import { CloudComponent } from '../../../../../../../shareds/components/cloud/cloud.component';
import { ContactsModule } from '../../../../../contacts/contacts.module';
import { InstallationLocationSelectComponent } from '../../../../../../../shareds/components/installation-location-select/installation-location-select.component';
import { DeviceRecordsComponent } from '../../../../../../../shareds/components/device-records/device-records.component';
import { SmsCommandsDialogComponent } from 'src/app/shareds/components/sms-commands-dialog/sms-commands-dialog.component';
import { SmsLocationPipe } from 'src/app/shareds/pipes/sms-location.pipe';


@NgModule({
  declarations: [
    TargetFormComponent
  ],
  imports: [
    UserNamePipe,
    DeviceLabelInputDirective,
    DeviceLabelPipe,
    CommonModule,
    PrimengModule,
    FormsModule,
    CloudComponent,
    ContactsModule,
    InstallationLocationSelectComponent,
    DeviceRecordsComponent,
    SmsCommandsDialogComponent,
    SmsLocationPipe
  ],
  exports: [
    TargetFormComponent
  ]
})
export class TargetFormModule { }
