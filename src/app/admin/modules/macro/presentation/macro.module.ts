import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { PrimengModule } from '../../../../shareds/libraries/primeng/primeng.module';
import { MacroRoutingModule } from './macro-routing.module';
import { MacroComponent } from './components/macro/macro.component';

@NgModule({
  declarations: [MacroComponent],
  imports: [CommonModule, FormsModule, TranslateModule, PrimengModule, MacroRoutingModule],
})
export class MacroModule {}

