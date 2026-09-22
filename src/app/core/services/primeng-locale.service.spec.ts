import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { providePrimeNG, PrimeNG } from 'primeng/config';
import { PrimeNgLocaleService } from './primeng-locale.service';

describe('PrimeNgLocaleService', () => {
  let translate: TranslateService;
  let primeng: PrimeNG;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [providePrimeNG()],
    });
    translate = TestBed.inject(TranslateService);
    primeng = TestBed.inject(PrimeNG);
    translate.setTranslation('es', { common: { yes: 'Sí', no: 'No' } });
    translate.setTranslation('fr', { common: { yes: 'Oui', no: 'Non' } });
    translate.setTranslation('xx', {});
  });

  it('translates the default confirmation buttons to the active language', () => {
    TestBed.inject(PrimeNgLocaleService).start();
    translate.use('es');
    expect(primeng.getTranslation('accept')).toBe('Sí');
    expect(primeng.getTranslation('reject')).toBe('No');

    translate.use('fr');
    expect(primeng.getTranslation('accept')).toBe('Oui');
    expect(primeng.getTranslation('reject')).toBe('Non');
  });

  it('keeps the previous labels when the language has no translation', () => {
    TestBed.inject(PrimeNgLocaleService).start();
    translate.use('es');
    translate.use('xx');
    expect(primeng.getTranslation('accept')).toBe('Sí');
  });
});
