import { Injectable } from '@angular/core';
import { Lang } from './lang.interface';
import { StatusService } from '../status.service';



@Injectable({
  providedIn: 'root'
})
export class LangService {
  langList: Lang[] = [
    { name: 'Español', code: 'es' },
    { name: 'English', code: 'en' },
    { name: 'Frances', code: 'fr' }
];
   selectedLang: string = localStorage.getItem('lang') || 'es';;

  constructor(private status: StatusService) {
    this.selectedLang = this.status.getState<string>('lang') || 'es';
    this.setLanguage(this.selectedLang);
  }

  getLanguages(): Lang[] {
    return this.langList;
  }

  setLanguage(lang: string) {
    this.selectedLang = lang;
    this.status.setState('lang', lang);
  }
}