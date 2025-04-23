import { Injectable } from '@angular/core';
import { Lang } from './lang.interface';
import { StatusService } from '../status.service';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class LangService {
  langList: Lang[] = [
    { name: 'Español', code: 'es' },
    { name: 'English', code: 'en' },
    { name: 'Frances', code: 'fr' }
  ];
  selectedLang: string = localStorage.getItem('lang') || 'es';

  constructor(
    private status: StatusService,
    private translateService: TranslateService
  ) {
    this.selectedLang = this.status.getState<string>('lang') || 'es';
    this.setLanguage(this.selectedLang);
  }

  getLanguages(): Lang[] {
    return this.langList;
  }

  setLanguage(lang: string): void {
    this.selectedLang = lang;
    this.status.setState('lang', lang);
    this.translateService.use(lang);
  }

  translate(key: string): string {
    try {
      const translation = this.translateService.instant(key);
      return typeof translation === 'string' ? translation : key;
    } catch (error) {
      console.warn(`Error al traducir la clave "${key}":`, error);
      return key;
    }
  }
}