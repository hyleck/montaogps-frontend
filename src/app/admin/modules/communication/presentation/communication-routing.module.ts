import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CommunicationComponent } from './components/communication/communication.component';

const routes: Routes = [
  { path: '', redirectTo: 'chat', pathMatch: 'full' },
  { path: ':tab', component: CommunicationComponent, data: { reuseKey: 'communication' } },
  { path: ':tab/:conversationId', component: CommunicationComponent, data: { reuseKey: 'communication' } },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CommunicationRoutingModule { }
