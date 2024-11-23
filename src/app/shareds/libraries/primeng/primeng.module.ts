import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BadgeModule } from 'primeng/badge';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    BadgeModule,
    TooltipModule,
    TableModule
  ],
  exports: [
    BadgeModule,
    BreadcrumbModule,
    TooltipModule,
    TableModule
  ]
})
export class PrimengModule { }
