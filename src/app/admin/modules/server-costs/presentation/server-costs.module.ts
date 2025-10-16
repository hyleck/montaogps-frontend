import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';
import { FormsModule } from '@angular/forms';

import { ServerCostsRoutingModule } from './server-costs-routing.module';
import { ServerCostsComponent } from './components/server-costs/server-costs.component';

@NgModule({
  declarations: [
    ServerCostsComponent
  ],
  imports: [
    CommonModule,
    TranslateModule,
    PrimengModule,
    FormsModule,
    ServerCostsRoutingModule
  ]
})
export class ServerCostsModule {}
