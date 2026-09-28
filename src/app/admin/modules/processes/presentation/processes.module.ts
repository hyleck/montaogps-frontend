import { UserNamePipe } from 'src/app/shareds/pipes/user-name.pipe';
import { DeviceLabelPipe } from 'src/app/shareds/pipes/device-label.pipe';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProcessesRoutingModule } from './processes-routing.module';
import { ProcessesComponent } from './components/processes/processes.component';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';
import { TranslateModule } from '@ngx-translate/core';
import { DeviceRecordsComponent } from 'src/app/shareds/components/device-records/device-records.component';

@NgModule({
  declarations: [
    ProcessesComponent
  ],
  imports: [
    UserNamePipe,
    DeviceRecordsComponent,
    DeviceLabelPipe,
    CommonModule,
    FormsModule,
    ProcessesRoutingModule,
    PrimengModule,
    TranslateModule
  ]
})
export class ProcessesModule { }
