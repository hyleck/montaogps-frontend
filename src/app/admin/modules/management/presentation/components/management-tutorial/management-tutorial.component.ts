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
  /** Estado del reproductor propio: los controles nativos se ocultan solos al reproducir. */
  readonly playing = signal(false);
  readonly current = signal(0);
  readonly duration = signal(0);
  readonly muted = signal(false);
  readonly captions = signal(true);
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
  @ViewChild('stage') stage?: ElementRef<HTMLElement>;
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

  /** Reproduce o pausa el video. */
  togglePlay(): void {
    const video = this.player?.nativeElement;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  }

  /** Adelanta o retrocede los segundos indicados. */
  skip(seconds: number): void {
    const video = this.player?.nativeElement;
    if (!video) return;
    const limit = Number.isFinite(video.duration) ? video.duration : this.duration();
    video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), limit || 0);
    this.current.set(video.currentTime);
  }

  seek(event: Event): void {
    const video = this.player?.nativeElement;
    const value = Number((event.target as HTMLInputElement).value);
    if (!video || !Number.isFinite(value)) return;
    video.currentTime = value;
    this.current.set(value);
  }

  toggleMute(): void {
    const video = this.player?.nativeElement;
    if (!video) return;
    video.muted = !video.muted;
    this.muted.set(video.muted);
  }

  /** Muestra u oculta los subtítulos en español del instructivo. */
  toggleCaptions(): void {
    const video = this.player?.nativeElement;
    const track = video?.textTracks?.[0];
    const on = !this.captions();
    if (track) track.mode = on ? 'showing' : 'hidden';
    this.captions.set(on);
  }

  toggleFullscreen(): void {
    const stage = this.stage?.nativeElement;
    if (!stage) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void stage.requestFullscreen?.().catch(() => undefined);
  }

  onLoaded(): void {
    const video = this.player?.nativeElement;
    if (!video) return;
    this.duration.set(Number.isFinite(video.duration) ? video.duration : 0);
    this.muted.set(video.muted);
    const track = video.textTracks?.[0];
    if (track) track.mode = this.captions() ? 'showing' : 'hidden';
  }

  onTime(): void {
    this.current.set(this.player?.nativeElement.currentTime ?? 0);
  }

  onVolume(): void {
    this.muted.set(this.player?.nativeElement.muted ?? false);
  }

  /** Segundos como m:ss para el contador de los controles. */
  clock(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
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
    this.playing.set(false);
    this.current.set(0);
    this.duration.set(0);
    this.source.set('');
  }
}
