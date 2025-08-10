import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SettingsComponent } from './components/settings/settings.component';
import { SectorsSettingsComponent } from './components/settings/sectors-settings/sectors-settings.component';

const routes: Routes = [
  { path: '', component: SettingsComponent },
  { path: 'sectors', component: SectorsSettingsComponent }
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SettingsRoutingModule { }
