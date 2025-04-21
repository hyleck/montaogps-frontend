import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

/* 👇  NUEVOS imports */
import { provideHttpClient } from '@angular/common/http';              // <─ faltaba
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [
    provideHttpClient(),                               // Http Client v19
    provideAnimationsAsync(),                          // Animaciones “lazy”
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
