import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { RedirectComponent } from './core/components/redirect/redirect.component';

/* 👇  NUEVOS imports */
import { provideHttpClient } from '@angular/common/http';              // <─ faltaba
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

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
    HttpClientModule,
    RedirectComponent,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    })
  ],
  providers: [
    provideHttpClient(),                               // Http Client v19
    provideAnimationsAsync(),                          // Animaciones "lazy"
    providePrimeNG({                                   // Tema Aura + dark‑mode
      theme: {
        preset: Aura,
        options: { darkModeSelector: '.app-dark' }
      }
    }),
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
