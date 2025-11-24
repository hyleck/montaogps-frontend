import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapsComponent } from './maps.component';
import { GoogleMapsModule } from '@angular/google-maps';
import { TranslateModule } from '@ngx-translate/core';


@NgModule({
  declarations: [
    MapsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    GoogleMapsModule,
    TranslateModule
  ],
  exports: [
    MapsComponent
  ]
})
export class MapsModule { }
