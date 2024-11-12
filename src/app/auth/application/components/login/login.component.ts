import { Component, inject } from '@angular/core';
import { ThemesService } from '../../../../shareds/services/themes.service';
import { TranslateService } from '@ngx-translate/core';
import { Lang } from '../../../../shareds/services/langi18/lang.interface';
import { LangService } from '../../../../shareds/services/langi18/lang.service';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  translate: TranslateService = inject(TranslateService);
  lang: string = 'es';
  theme: string = 'light';

  languages: Lang[] | undefined;

  selectedLang: string = 'es';
  constructor(public themes: ThemesService, private _lang: LangService) {

    this.themes.setTheme('light');
    this.languages = this._lang.getLangs()

   }

   ngOnInit() {
   
}

    toggleTheme() {
      this.theme = this.themes.getCurrentTheme();
      this.themes.setTheme(this.theme === 'light' ? 'dark' : 'light');
      this.theme = this.themes.getCurrentTheme();
    }

    changeLang() {
      this.translate.use(this.selectedLang || 'es');
      console.log('lang', this.selectedLang);
    }
}
