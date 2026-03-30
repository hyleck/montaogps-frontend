import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';
import { DrawerModule } from 'primeng/drawer';
import { TooltipModule } from 'primeng/tooltip';
import { CalendarModule } from 'primeng/calendar';

import { ConfirmationService, MessageService } from 'primeng/api';

@NgModule({
    declarations: [],
    imports: [
        CommonModule,
        BadgeModule,
        ButtonModule,
        MenuModule,
        DialogModule,
        ToastModule,
        ProgressBarModule,
        DrawerModule,
        TooltipModule,
        CalendarModule
    ],
    exports: [
        BadgeModule,
        ButtonModule,
        MenuModule,
        DialogModule,
        ToastModule,
        ProgressBarModule,
        DrawerModule,
        TooltipModule,
        CalendarModule
    ],
    providers: []
})
export class PrimengCoreModule { }
