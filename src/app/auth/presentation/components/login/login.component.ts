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

  // UI/UX
  translate: TranslateService = inject(TranslateService);
  lang: string = 'es';
  theme: string = 'light';

  languages: Lang[] | undefined;

  constructor(public themes: ThemesService, public langService: LangService ) {}

  
   ngOnInit() {  
    this.theme = this.themes.getCurrentTheme();
    this.languages = this.langService.getLanguages()
    this.translate.use(this.langService.selectedLang || 'es');
   }

    toggleTheme() {
      
      this.themes.setTheme(this.theme === 'light' ? 'dark' : 'light');
      this.theme = this.themes.getCurrentTheme();
    
    }

    changeLang() {
      this.translate.use(this.langService.selectedLang || 'es');
      this.langService.setLanguage(this.langService.selectedLang);
    }
    
}
