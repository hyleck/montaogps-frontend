import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserFormComponent } from './user-form.component';
import { TabViewModule } from 'primeng/tabview';
import { AccordionModule } from 'primeng/accordion';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    UserFormComponent
  ],
  imports: [
    CommonModule,
    TabViewModule,
    AccordionModule,
    FormsModule
  ],
  exports: [
    UserFormComponent
  ]
})
export class UserFormModule { }
