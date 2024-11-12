import { Injectable } from '@angular/core';
import { Lang } from './lang.interface';



@Injectable({
  providedIn: 'root'
})
export class LangService {
  cities: Lang[] = [
    { name: 'Español', code: 'es' },
    { name: 'English', code: 'en' },
    { name: 'Frances', code: 'fr' }
];
   selectedLang: string = localStorage.getItem('lang') || 'es';;

  constructor() { 
  }

  getLangs(): Lang[] {
    return this.cities;
  }
}