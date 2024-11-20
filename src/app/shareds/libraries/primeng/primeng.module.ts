import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BadgeModule } from 'primeng/badge';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TooltipModule } from 'primeng/tooltip';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    BadgeModule,
    TooltipModule
  ],
  exports: [
    BadgeModule,
    BreadcrumbModule,
    TooltipModule
  ]
})
export class PrimengModule { }
