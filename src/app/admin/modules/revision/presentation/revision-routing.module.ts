import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RevisionComponent } from './components/revision/revision.component';

const routes: Routes = [{ path: '', component: RevisionComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RevisionRoutingModule {}
