import { Component, OnDestroy, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Subscription, catchError, of, switchMap, timer } from 'rxjs';
import {
  EsterKnowledgeEntry,
  EsterKnowledgePayload,
  EsterService,
  EsterSkill,
  EsterWorkflowNode,
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
  activeView: 'knowledge' | 'skills' | 'workflow' = 'knowledge';
  skills: EsterSkill[] = [];
  skillsLoading = true;
  private readonly updatingSkillIds = new Set<string>();
  workflowRuns: EsterWorkflowRun[] = [];
  selectedWorkflowRunId = '';
  workflowLoading = false;
  workflowError = false;
  workflowUpdatedAt?: Date;
  private workflowSubscription?: Subscription;
  private workflowBaselineEstablished = false;
  private readonly workflowRevealCount = new Map<string, number>();
  private readonly workflowAnimationTimers = new Map<
    string,
    ReturnType<typeof setInterval>
  >();

  form: EsterKnowledgeForm = this.emptyForm();

  constructor(
    private readonly esterService: EsterService,
    private readonly messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.loadEntries();
    this.loadSkills();
  }

  ngOnDestroy(): void {
    this.workflowSubscription?.unsubscribe();
    this.workflowAnimationTimers.forEach(animationTimer =>
      clearInterval(animationTimer),
    );
    this.workflowAnimationTimers.clear();
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

  setActiveView(view: 'knowledge' | 'skills' | 'workflow'): void {
    this.activeView = view;
    if (view === 'workflow' && !this.workflowSubscription) {
      this.startWorkflowPolling();
    }
  }

  get activeViewTitle(): string {
    const titles = {
      knowledge: 'Base de conocimiento',
      skills: 'Habilidades',
      workflow: 'Flujo de trabajo',
    };
    return titles[this.activeView];
  }

  get activeViewDescription(): string {
    const descriptions = {
      knowledge:
        'Administra la información que Ester utiliza al responder a los clientes.',
      skills:
        'Controla las capacidades incorporadas en el código de Ester.',
      workflow:
        'Supervisa en vivo cómo Ester procesa y responde cada conversación.',
    };
    return descriptions[this.activeView];
  }

  get activeSkillsCount(): number {
    return this.skills.filter(skill => skill.active).length;
  }

  get allAudienceSkills(): EsterSkill[] {
    return this.skills.filter(skill => skill.audience === 'all');
  }

  get registeredUserSkills(): EsterSkill[] {
    return this.skills.filter(skill => skill.audience !== 'all');
  }

  get allAudienceActiveCount(): number {
    return this.allAudienceSkills.filter(skill => skill.active).length;
  }

  get registeredUserActiveCount(): number {
    return this.registeredUserSkills.filter(skill => skill.active).length;
  }

  selectWorkflowRun(run: EsterWorkflowRun): void {
    this.selectedWorkflowRunId = run._id;
    if (!this.workflowRevealCount.has(run._id)) {
      this.revealWorkflowImmediately(run);
    }
  }

  getAnimatedNodeStatus(
    run: EsterWorkflowRun,
    node: EsterWorkflowNode,
    index: number,
  ): EsterWorkflowStatus {
    const revealCount = this.workflowRevealCount.get(run._id)
      ?? run.nodes.length;

    if (index < revealCount) {
      return node.status;
    }

    if (index === revealCount && revealCount < run.nodes.length) {
      return 'running';
    }

    return 'pending';
  }

  getWorkflowConnectorStatus(
    run: EsterWorkflowRun,
    node: EsterWorkflowNode,
    index: number,
  ): EsterWorkflowStatus {
    const revealCount = this.workflowRevealCount.get(run._id)
      ?? run.nodes.length;

    if (index >= revealCount) {
      return 'pending';
    }

    return node.status;
  }

  isWorkflowNodeVisible(run: EsterWorkflowRun, index: number): boolean {
    const revealCount = this.workflowRevealCount.get(run._id)
      ?? run.nodes.length;
    return index <= revealCount;
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

  loadSkills(): void {
    this.skillsLoading = true;
    this.esterService.getSkills().subscribe({
      next: skills => {
        this.skills = skills || [];
        this.skillsLoading = false;
      },
      error: () => {
        this.skillsLoading = false;
        this.notify(
          'error',
          'No se pudieron cargar las habilidades de Ester.',
        );
      },
    });
  }

  toggleSkill(skill: EsterSkill): void {
    if (this.updatingSkillIds.has(skill.id)) return;

    this.updatingSkillIds.add(skill.id);
    this.esterService
      .updateSkillState(skill.id, !skill.active)
      .subscribe({
        next: updated => {
          this.skills = this.skills.map(current =>
            current.id === updated.id ? updated : current,
          );
          this.updatingSkillIds.delete(skill.id);
          this.notify(
            'success',
            updated.active
              ? `${updated.name} fue activada.`
              : `${updated.name} fue desactivada.`,
          );
        },
        error: () => {
          this.updatingSkillIds.delete(skill.id);
          this.notify(
            'error',
            'No se pudo cambiar el estado de la habilidad.',
          );
        },
      });
  }

  isUpdatingSkill(skillId: string): boolean {
    return this.updatingSkillIds.has(skillId);
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

  trackWorkflowNode(_: number, node: EsterWorkflowNode): string {
    return node.id;
  }

  trackSkill(_: number, skill: EsterSkill): string {
    return skill.id;
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

        const previousRunIds = new Set(
          this.workflowRuns.map(run => run._id),
        );
        const currentRunIds = new Set(runs.map(run => run._id));
        const newRuns = this.workflowBaselineEstablished
          ? runs.filter(run => !previousRunIds.has(run._id))
          : [];

        this.workflowAnimationTimers.forEach((animationTimer, runId) => {
          if (!currentRunIds.has(runId)) {
            clearInterval(animationTimer);
            this.workflowAnimationTimers.delete(runId);
            this.workflowRevealCount.delete(runId);
          }
        });

        this.workflowRuns = runs;

        if (!this.workflowBaselineEstablished) {
          runs.forEach(run => this.revealWorkflowImmediately(run));
          this.workflowBaselineEstablished = true;
        } else {
          runs.forEach(run => {
            if (
              !newRuns.some(newRun => newRun._id === run._id)
              && !this.workflowRevealCount.has(run._id)
            ) {
              this.revealWorkflowImmediately(run);
            }
          });
          newRuns.forEach(run => this.startWorkflowAnimation(run));
        }

        if (newRuns.length) {
          this.selectedWorkflowRunId = newRuns[0]._id;
        } else if (
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

  private startWorkflowAnimation(run: EsterWorkflowRun): void {
    const existingTimer = this.workflowAnimationTimers.get(run._id);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    this.workflowRevealCount.set(run._id, 0);

    if (!run.nodes.length) {
      return;
    }

    const animationTimer = setInterval(() => {
      const currentRevealCount = this.workflowRevealCount.get(run._id) ?? 0;
      const nextRevealCount = Math.min(
        currentRevealCount + 1,
        run.nodes.length,
      );
      this.workflowRevealCount.set(run._id, nextRevealCount);

      if (nextRevealCount >= run.nodes.length) {
        clearInterval(animationTimer);
        this.workflowAnimationTimers.delete(run._id);
      }
    }, 420);

    this.workflowAnimationTimers.set(run._id, animationTimer);
  }

  private revealWorkflowImmediately(run: EsterWorkflowRun): void {
    const existingTimer = this.workflowAnimationTimers.get(run._id);
    if (existingTimer) {
      clearInterval(existingTimer);
      this.workflowAnimationTimers.delete(run._id);
    }
    this.workflowRevealCount.set(run._id, run.nodes.length);
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
