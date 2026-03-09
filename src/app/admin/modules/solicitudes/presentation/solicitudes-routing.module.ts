import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SolicitudesComponent } from './components/solicitudes/solicitudes.component';

const routes: Routes = [
    { path: '', component: SolicitudesComponent }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class SolicitudesRoutingModule { }
