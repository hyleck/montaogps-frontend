import { NgModule } from '@angular/core';
import { RouterModule, Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { ManagementComponent } from './components/management/management.component';

function managementRouteMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length < 1 || segments.length > 2) return null;
  const op = segments[0].path;
  if (!['u', 't'].includes(op)) return null;
  if (segments.length === 2 && !/^[a-f\d]{24}$/i.test(segments[1].path)) {
    return null;
  }

  return {
    consumed: segments,
    posParams: {
      op: segments[0],
      ...(segments[1] ? { user: segments[1] } : {}),
    },
  };
}

const routes: Routes = [
  { path: '', component: ManagementComponent },
  { matcher: managementRouteMatcher, component: ManagementComponent },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ManagementRoutingModule { }
