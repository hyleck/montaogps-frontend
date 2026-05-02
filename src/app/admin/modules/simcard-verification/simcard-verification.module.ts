import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SimcardVerificationRoutingModule } from './simcard-verification-routing.module';
import { SimcardVerificationComponent } from './presentation/components/simcard-verification/simcard-verification.component';
import { EmnifyVerificationComponent } from './presentation/components/emnify-verification/emnify-verification.component';


import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { AccordionModule } from 'primeng/accordion';

import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';

@NgModule({
  declarations: [
    SimcardVerificationComponent,
    EmnifyVerificationComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    SimcardVerificationRoutingModule,
    TableModule,
    ButtonModule,
    FileUploadModule,
    AccordionModule,
    TabViewModule,
    TagModule,
    InputTextModule
  ]
})
export class SimcardVerificationModule { }
