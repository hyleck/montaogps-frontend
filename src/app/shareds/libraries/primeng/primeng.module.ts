import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BadgeModule } from 'primeng/badge';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { MenuModule } from 'primeng/menu';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TabViewModule } from 'primeng/tabview';
import { AccordionModule } from 'primeng/accordion';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ProgressBarModule } from 'primeng/progressbar';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmationService, MessageService } from 'primeng/api';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    BadgeModule,
    TooltipModule,
    TableModule,
    MenuModule,
    ButtonModule,
    DialogModule,
    TabViewModule,
    AccordionModule,
    ProgressSpinnerModule,
    ProgressBarModule,
    CardModule,
    InputTextModule,
    DropdownModule,
    ConfirmDialogModule,
    ToastModule,
    CheckboxModule
  ],
  exports: [
    BadgeModule,
    BreadcrumbModule,
    TooltipModule,
    TableModule,
    MenuModule,
    ButtonModule,
    DialogModule,
    TabViewModule,
    AccordionModule,
    ProgressSpinnerModule,
    ProgressBarModule,
    CardModule,
    InputTextModule,
    DropdownModule,
    ConfirmDialogModule,
    ToastModule,
    CheckboxModule
  ],
  providers: [ConfirmationService, MessageService]
})
export class PrimengModule { }
