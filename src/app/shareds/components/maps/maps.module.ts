import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapsComponent } from './maps.component';
import { GoogleMapsModule } from '@angular/google-maps';
import { TranslateModule } from '@ngx-translate/core';


@NgModule({
  declarations: [
    MapsComponent
  ],
  imports: [
    CommonModule,
    GoogleMapsModule,
    TranslateModule
  ],
  exports: [
    MapsComponent
  ]
})
export class MapsModule { }
