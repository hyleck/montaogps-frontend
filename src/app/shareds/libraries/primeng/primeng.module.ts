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
    ProgressBarModule
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
    ProgressBarModule
  ]
})
export class PrimengModule { }
