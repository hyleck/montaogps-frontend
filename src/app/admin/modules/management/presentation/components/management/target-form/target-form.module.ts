import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TargetFormComponent } from './target-form.component';
import { PrimengModule } from '../../../../../../../shareds/libraries/primeng/primeng.module';
import { FormsModule } from '@angular/forms';
import { CloudComponent } from '../../../../../../../shareds/components/cloud/cloud.component';
import { ContactsModule } from '../../../../../contacts/contacts.module';
import { InstallationLocationSelectComponent } from '../../../../../../../shareds/components/installation-location-select/installation-location-select.component';


@NgModule({
  declarations: [
    TargetFormComponent
  ],
  imports: [
    CommonModule,
    PrimengModule,
    FormsModule,
    CloudComponent,
    ContactsModule,
    InstallationLocationSelectComponent
  ],
  exports: [
    TargetFormComponent
  ]
})
export class TargetFormModule { }
