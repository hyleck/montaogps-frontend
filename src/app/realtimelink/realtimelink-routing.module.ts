import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RealtimelinkComponent } from './presentation/components/realtimelink/realtimelink.component';

const routes: Routes = [
    {
        path: '',
        component: RealtimelinkComponent
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class RealtimelinkRoutingModule { }
