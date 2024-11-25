import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BadgeModule } from 'primeng/badge';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { MenuModule } from 'primeng/menu';
import { ButtonModule } from 'primeng/button';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    BadgeModule,
    TooltipModule,
    TableModule,
    MenuModule,
    ButtonModule
  ],
  exports: [
    BadgeModule,
    BreadcrumbModule,
    TooltipModule,
    TableModule,
    MenuModule,
    ButtonModule
  ]
})
export class PrimengModule { }
