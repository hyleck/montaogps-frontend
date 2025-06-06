import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserFormComponent } from './user-form.component';
import { TabViewModule } from 'primeng/tabview';
import { AccordionModule } from 'primeng/accordion';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { TranslateModule } from '@ngx-translate/core';
import { ToastModule } from 'primeng/toast';

@NgModule({
  declarations: [
    UserFormComponent
  ],
  imports: [
    CommonModule,
    TabViewModule,
    AccordionModule,
    FormsModule,
    DropdownModule,
    CalendarModule,
    CheckboxModule,
    ButtonModule,
    TranslateModule,
    ToastModule
  ],
  exports: [
    UserFormComponent
  ]
})
export class UserFormModule { }
