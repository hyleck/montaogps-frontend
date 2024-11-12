import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
// import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
// import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

// export function HttpLoaderFactory(http: HttpClient) {
//   return new TranslateHttpLoader(http, './i18n/', '.json');
// }

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    // TranslateModule.forRoot({
    //   loader: {
    //       provide: TranslateLoader,
    //       useFactory: HttpLoaderFactory,
    //       deps: [HttpClient]
    //   },
    //   defaultLanguage: 'es'
    // })
  ],
  // providers: [
  //   provideHttpClient(withInterceptorsFromDi())
  // ],
  bootstrap: [AppComponent]
})
export class AppModule { }
