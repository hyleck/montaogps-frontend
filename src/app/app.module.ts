import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClient } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { PrimengModule } from './shareds/libraries/primeng/primeng.module';

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './i18n/', '.json');
}

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    PrimengModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    })
  ],
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: { darkModeSelector: '.app-dark' }
      }
    })
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
