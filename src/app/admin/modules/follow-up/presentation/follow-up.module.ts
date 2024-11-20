import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FollowUpRoutingModule } from './follow-up-routing.module';
import { FollowUpComponent } from './components/follow-up/follow-up.component';


@NgModule({
  declarations: [
    FollowUpComponent
  ],
  imports: [
    CommonModule,
    FollowUpRoutingModule
  ]
})
export class FollowUpModule { }
