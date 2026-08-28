import { DeviceLabelInputDirective } from 'src/app/shareds/directives/device-label-input.directive';
import { DeviceLabelPipe } from 'src/app/shareds/pipes/device-label.pipe';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';
import { SolicitudesRoutingModule } from './solicitudes-routing.module';
import { SolicitudesComponent } from './components/solicitudes/solicitudes.component';
import { SolicitudAssistanceComponent } from './components/solicitud-assistance/solicitud-assistance.component';
import { InstallationLocationSelectComponent } from '../../../../shareds/components/installation-location-select/installation-location-select.component';

@NgModule({
    declarations: [SolicitudesComponent, SolicitudAssistanceComponent],
    imports: [
        DeviceLabelInputDirective,
        DeviceLabelPipe, CommonModule, FormsModule, TranslateModule, PrimengModule, SolicitudesRoutingModule, InstallationLocationSelectComponent
    ],
})
export class SolicitudesModule { }
