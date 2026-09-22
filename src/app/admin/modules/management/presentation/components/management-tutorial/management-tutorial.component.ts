import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../../../../../../environments/environment';
import { AuthService } from '../../../../../../core/services/auth.service';
import { MANAGEMENT_TUTORIALS, TutorialVideo } from './management-tutorial.data';

/**
 * Botón «¿Qué hacer?»: abre a pantalla completa los instructivos en video del módulo, como en
 * Montao Talleres. Con varios instructivos muestra primero el catálogo (buscador y categorías);
 * con uno solo abre directamente su video. La URL de reproducción la resuelve el backend
 * (GET /tutorials/:id/playback) desde Montao Cloud.
 */
@Component({
  selector: 'app-management-tutorial',
  standalone: true,
  templateUrl: './management-tutorial.component.html',
  styleUrl: './management-tutorial.component.css',
})
export class ManagementTutorialComponent implements OnDestroy {
  /** Instructivos del módulo; por defecto, los de Gestión. */
  @Input() set tutorials(list: readonly TutorialVideo[]) {
    this.all.set(list);
  }
  get tutorials(): readonly TutorialVideo[] {
    return this.list();
  }
  /** Nombre del módulo que se muestra en el encabezado del instructivo. */
  @Input() module = 'Gestión';
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly all = signal<readonly TutorialVideo[]>(MANAGEMENT_TUTORIALS);
  private readonly permissionsVersion = signal(0);
  /**
   * Solo las guías que el usuario puede ejecutar: los mismos privilegios que exige cada acción
   * en Gestión y en el backend (p. ej. devices.update) y, si la guía lo pide, ser personal de
   * Montao (empleado o root).
   */
  readonly list = computed(() => {
    // Los privilegios viven en localStorage y pueden actualizarse después del inicio de sesión:
    // se vuelven a leer cada vez que se abre el visor.
    this.permissionsVersion();
    return this.all().filter((tutorial) => this.allowed(tutorial));
  });
  readonly visible = signal(false);
  readonly selected = signal<TutorialVideo | null>(null);
  readonly query = signal('');
  readonly category = signal('Todas');
  readonly source = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly categories = computed(() => [
    'Todas',
    ...new Set(this.list().map((tutorial) => tutorial.category)),
  ]);
  readonly filtered = computed(() => {
    const normalize = (text: string) =>
      text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();
    const words = normalize(this.query()).trim().split(/\s+/);
    return this.list().filter(
      (tutorial) =>
        (this.category() === 'Todas' || tutorial.category === this.category()) &&
        words.every((word) =>
          normalize(
            `${tutorial.title} ${tutorial.description} ${tutorial.category} ${tutorial.steps.join(' ')}`,
          ).includes(word),
        ),
    );
  });
  @ViewChild('player') player?: ElementRef<HTMLVideoElement>;
  @ViewChild('closeButton') set closeButton(ref: ElementRef<HTMLButtonElement> | undefined) {
    ref?.nativeElement.focus({ preventScroll: true });
  }
  private opener: HTMLElement | null = null;
  // Cada video que se abre invalida las respuestas tardías del anterior.
  private requestId = 0;
  /**
   * Montao Cloud puede responder 503 a una descarga puntual del video. En vez de dejar al
   * usuario con el error, se reintenta solo con un enlace nuevo antes de mostrar el aviso.
   */
  private static readonly MAX_RETRIES = 2;
  private retries = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;

  open(event?: Event): void {
    this.opener = (event?.currentTarget as HTMLElement | null) ?? null;
    this.permissionsVersion.update((version) => version + 1);
    this.resetSearch();
    this.visible.set(true);
    const list = this.list();
    if (list.length === 1) this.watch(list[0]);
    else this.back();
  }

  watch(tutorial: TutorialVideo): void {
    this.selected.set(tutorial);
    void this.load();
  }

  async load(auto = false): Promise<void> {
    const tutorial = this.selected();
    if (!tutorial) return;
    if (!auto) this.retries = 0;
    const request = ++this.requestId;
    this.stop();
    this.loading.set(true);
    this.error.set('');
    try {
      const video = await firstValueFrom(
        this.http
          .get<{ playbackUrl: string }>(
            `${environment.apiUrl}/tutorials/${encodeURIComponent(tutorial.id)}/playback`,
          )
          .pipe(timeout(20_000)),
      );
      if (request !== this.requestId) return;
      if (new URL(video.playbackUrl).protocol !== 'https:') throw new Error('Invalid URL');
      this.source.set(video.playbackUrl);
    } catch {
      if (request !== this.requestId) return;
      this.error.set('No pudimos cargar el video. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      if (request === this.requestId) this.loading.set(false);
    }
  }

  private allowed(tutorial: TutorialVideo): boolean {
    const user = this.auth.getCurrentUser();
    if (!user) return false;
    const employee =
      String(user.affiliation_type_id || '').trim().toLowerCase() === 'empleado' || user.root === true;
    if (tutorial.requires.employee && !employee) return false;
    return tutorial.requires.privileges.every((privilege) => {
      const [module, action] = privilege.split('.');
      return this.auth.hasPrivilege(module, action);
    });
  }

  /** Vuelve al catálogo de instructivos del módulo. */
  back(): void {
    this.requestId++;
    this.stop();
    this.selected.set(null);
    this.loading.set(false);
    this.error.set('');
  }

  resetSearch(): void {
    this.query.set('');
    this.category.set('Todas');
  }

  mediaError(): void {
    this.source.set('');
    if (this.retries < ManagementTutorialComponent.MAX_RETRIES) {
      this.retries++;
      this.error.set('');
      this.loading.set(true);
      this.retryTimer = setTimeout(() => void this.load(true), 700 * this.retries);
      return;
    }
    this.error.set('La reproducción se interrumpió. Vuelve a cargar el video para continuar.');
  }

  close(): void {
    this.back();
    this.visible.set(false);
    this.opener?.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible()) this.close();
  }

  ngOnDestroy(): void {
    this.requestId++;
    this.stop();
  }

  private stop(): void {
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    const video = this.player?.nativeElement;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    this.source.set('');
  }
}
