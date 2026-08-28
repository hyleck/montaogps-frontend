import { DeviceLabelPipe } from 'src/app/shareds/pipes/device-label.pipe';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RevisionComponent } from './components/revision/revision.component';
import { RevisionRoutingModule } from './revision-routing.module';

@NgModule({
  declarations: [RevisionComponent],
  imports: [
    DeviceLabelPipe, CommonModule, FormsModule, RevisionRoutingModule
  ],
})
export class RevisionModule {}
