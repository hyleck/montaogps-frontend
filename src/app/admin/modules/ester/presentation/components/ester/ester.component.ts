import { Component, OnDestroy, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Subscription, catchError, of, switchMap, timer } from 'rxjs';
import {
  EsterKnowledgeEntry,
  EsterKnowledgePayload,
  EsterService,
  EsterWorkflowRun,
  EsterWorkflowStatus,
} from '@core/services/ester.service';

interface EsterKnowledgeForm {
  title: string;
  category: string;
  content: string;
  active: boolean;
}

@Component({
  selector: 'app-ester',
  templateUrl: './ester.component.html',
  styleUrls: ['./ester.component.css'],
  standalone: false,
})
export class EsterComponent implements OnInit, OnDestroy {
  entries: EsterKnowledgeEntry[] = [];
  loading = true;
  saving = false;
  editorVisible = false;
  deletingId = '';
  editingId = '';
  searchTerm = '';
  activeView: 'knowledge' | 'workflow' = 'knowledge';
  workflowRuns: EsterWorkflowRun[] = [];
  selectedWorkflowRunId = '';
  workflowLoading = false;
  workflowError = false;
  workflowUpdatedAt?: Date;
  private workflowSubscription?: Subscription;

  form: EsterKnowledgeForm = this.emptyForm();

  constructor(
    private readonly esterService: EsterService,
    private readonly messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.loadEntries();
  }

  ngOnDestroy(): void {
    this.workflowSubscription?.unsubscribe();
  }

  get activeCount(): number {
    return this.entries.filter(entry => entry.active).length;
  }

  get categoriesCount(): number {
    return new Set(
      this.entries.map(entry => entry.category || 'General'),
    ).size;
  }

  get filteredEntries(): EsterKnowledgeEntry[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.entries;
    return this.entries.filter(entry =>
      [entry.title, entry.category, entry.content]
        .some(value => String(value || '').toLowerCase().includes(term)),
    );
  }

  get selectedWorkflowRun(): EsterWorkflowRun | undefined {
    return this.workflowRuns.find(
      run => run._id === this.selectedWorkflowRunId,
    ) || this.workflowRuns[0];
  }

  setActiveView(view: 'knowledge' | 'workflow'): void {
    this.activeView = view;
    if (view === 'workflow' && !this.workflowSubscription) {
      this.startWorkflowPolling();
    }
  }

  selectWorkflowRun(run: EsterWorkflowRun): void {
    this.selectedWorkflowRunId = run._id;
  }

  getWorkflowStatusLabel(status: EsterWorkflowStatus | string): string {
    const labels: Record<string, string> = {
      pending: 'En espera',
      running: 'Ejecutando',
      success: 'Completado',
      skipped: 'Omitido',
      error: 'Error',
    };
    return labels[status] || status;
  }

  getWorkflowStatusIcon(status: EsterWorkflowStatus | string): string {
    const icons: Record<string, string> = {
      pending: 'pi-clock',
      running: 'pi-spin pi-spinner',
      success: 'pi-check',
      skipped: 'pi-minus',
      error: 'pi-times',
    };
    return icons[status] || 'pi-circle';
  }

  getWorkflowDuration(run: EsterWorkflowRun): string {
    const start = new Date(run.started_at).getTime();
    const end = run.completed_at
      ? new Date(run.completed_at).getTime()
      : Date.now();
    const milliseconds = Math.max(0, end - start);
    if (milliseconds < 1000) return `${milliseconds} ms`;
    return `${(milliseconds / 1000).toFixed(1)} s`;
  }

  loadEntries(): void {
    this.loading = true;
    this.esterService.getKnowledge().subscribe({
      next: entries => {
        this.entries = entries || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notify(
          'error',
          'No se pudo cargar la base de conocimiento de Ester.',
        );
      },
    });
  }

  openCreate(): void {
    this.editingId = '';
    this.form = this.emptyForm();
    this.editorVisible = true;
  }

  openEdit(entry: EsterKnowledgeEntry): void {
    this.editingId = entry._id;
    this.form = {
      title: entry.title,
      category: entry.category || 'General',
      content: entry.content,
      active: entry.active,
    };
    this.editorVisible = true;
  }

  closeEditor(): void {
    if (this.saving) return;
    this.editorVisible = false;
    this.editingId = '';
    this.form = this.emptyForm();
  }

  save(): void {
    const payload: EsterKnowledgePayload = {
      title: this.form.title.trim(),
      category: this.form.category.trim() || 'General',
      content: this.form.content.trim(),
      active: this.form.active,
    };
    if (!payload.title || !payload.content) {
      this.notify('warn', 'Completa el título y el contenido.');
      return;
    }

    this.saving = true;
    const wasEditing = Boolean(this.editingId);
    const request = this.editingId
      ? this.esterService.updateKnowledge(this.editingId, payload)
      : this.esterService.createKnowledge(payload);

    request.subscribe({
      next: saved => {
        if (this.editingId) {
          this.entries = this.entries.map(entry =>
            entry._id === saved._id ? saved : entry,
          );
        } else {
          this.entries = [saved, ...this.entries];
        }
        this.saving = false;
        this.closeEditor();
        this.notify(
          'success',
          wasEditing
            ? 'Conocimiento actualizado.'
            : 'Conocimiento agregado a Ester.',
        );
      },
      error: () => {
        this.saving = false;
        this.notify('error', 'No se pudo guardar el conocimiento.');
      },
    });
  }

  toggleActive(entry: EsterKnowledgeEntry): void {
    this.esterService
      .updateKnowledge(entry._id, { active: !entry.active })
      .subscribe({
        next: updated => {
          this.entries = this.entries.map(current =>
            current._id === updated._id ? updated : current,
          );
          this.notify(
            'success',
            updated.active
              ? 'Ester volverá a usar esta información.'
              : 'Información desactivada para las respuestas.',
          );
        },
        error: () => {
          this.notify('error', 'No se pudo cambiar el estado.');
        },
      });
  }

  remove(entry: EsterKnowledgeEntry): void {
    const confirmed = window.confirm(
      `¿Eliminar "${entry.title}" de la base de conocimiento de Ester?`,
    );
    if (!confirmed) return;

    this.deletingId = entry._id;
    this.esterService.deleteKnowledge(entry._id).subscribe({
      next: () => {
        this.entries = this.entries.filter(current => current._id !== entry._id);
        this.deletingId = '';
        this.notify('success', 'Conocimiento eliminado.');
      },
      error: () => {
        this.deletingId = '';
        this.notify('error', 'No se pudo eliminar el conocimiento.');
      },
    });
  }

  trackById(_: number, entry: EsterKnowledgeEntry): string {
    return entry._id;
  }

  trackWorkflowRun(_: number, run: EsterWorkflowRun): string {
    return run._id;
  }

  private startWorkflowPolling(): void {
    this.workflowLoading = true;
    this.workflowSubscription = timer(0, 2000)
      .pipe(
        switchMap(() =>
          this.esterService.getWorkflowRuns().pipe(
            catchError(() => {
              this.workflowError = true;
              return of(null as EsterWorkflowRun[] | null);
            }),
          ),
        ),
      )
      .subscribe(runs => {
        if (runs === null) {
          this.workflowLoading = false;
          return;
        }
        this.workflowRuns = runs;
        if (
          runs.length
          && !runs.some(run => run._id === this.selectedWorkflowRunId)
        ) {
          this.selectedWorkflowRunId = runs[0]._id;
        }
        this.workflowLoading = false;
        this.workflowError = false;
        this.workflowUpdatedAt = new Date();
      });
  }

  private emptyForm(): EsterKnowledgeForm {
    return {
      title: '',
      category: 'General',
      content: '',
      active: true,
    };
  }

  private notify(
    severity: 'success' | 'error' | 'warn',
    detail: string,
  ): void {
    this.messageService.add({
      severity,
      summary:
        severity === 'success'
          ? 'Listo'
          : severity === 'warn'
            ? 'Revisa la información'
            : 'Error',
      detail,
    });
  }
}
