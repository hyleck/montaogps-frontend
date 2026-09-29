import { DeviceLabelPipe } from 'src/app/shareds/pipes/device-label.pipe';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RevisionComponent } from './components/revision/revision.component';
import { RevisionRoutingModule } from './revision-routing.module';
import { SimcardTestingComponent } from './components/simcard-testing/simcard-testing.component';

@NgModule({
  declarations: [RevisionComponent],
  imports: [
    DeviceLabelPipe, CommonModule, FormsModule, RevisionRoutingModule, SimcardTestingComponent
  ],
})
export class RevisionModule {}
