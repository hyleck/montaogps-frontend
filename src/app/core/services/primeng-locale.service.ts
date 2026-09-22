import { Injectable, OnDestroy, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PrimeNG } from 'primeng/config';
import { Subscription } from 'rxjs';

/**
 * Mantiene los textos por defecto de PrimeNG en el idioma activo de la app. Sin esto, las
 * confirmaciones que no definen acceptLabel/rejectLabel muestran «Yes»/«No» en inglés.
 */
@Injectable({ providedIn: 'root' })
export class PrimeNgLocaleService implements OnDestroy {
  private readonly translate = inject(TranslateService);
  private readonly primeng = inject(PrimeNG);
  private subscription?: Subscription;

  start(): void {
    if (this.subscription) return;
    this.subscription = this.translate.onLangChange.subscribe(() => this.apply());
    if (this.translate.currentLang) this.apply();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private apply(): void {
    this.subscription?.add(
      this.translate.get(['common.yes', 'common.no']).subscribe((t: Record<string, string>) => {
        const accept = t['common.yes'];
        const reject = t['common.no'];
        // Si falta la clave, ngx-translate devuelve la propia clave: se conserva el texto de PrimeNG.
        if (accept && accept !== 'common.yes' && reject && reject !== 'common.no') {
          this.primeng.setTranslation({ accept, reject });
        }
      }),
    );
  }
}
