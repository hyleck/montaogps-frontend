import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RealtimelinkRoutingModule } from './realtimelink-routing.module';
import { RealtimelinkComponent } from './presentation/components/realtimelink/realtimelink.component';

@NgModule({
    declarations: [
        RealtimelinkComponent
    ],
    imports: [
        CommonModule,
        RealtimelinkRoutingModule
    ]
})
export class RealtimelinkModule { }
