import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { InteraccionesService, UserList, UserListFilters } from '../../services/interacciones.service';
import { MessageService, ConfirmationService } from 'primeng/api';
import { FirebaseNotificationsService } from '@core/services/firebase-notifications.service';

@Component({
  selector: 'app-interacciones',
  templateUrl: './interacciones.component.html',
  styleUrl: './interacciones.component.css',
  standalone: false
})
export class InteraccionesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private previewTrigger$ = new Subject<void>();

  // ── Estado de listas ────────────────────────────────────────
  lists: UserList[] = [];
  selectedList: UserList | null = null;
  loadingLists = false;

  // ── Panel de creación/edición ───────────────────────────────
  showForm = false;
  isEditing = false;
  savingForm = false;

  formName = '';
  formDescription = '';
  formFilters: UserListFilters = {};

  // ── Preview de usuarios ─────────────────────────────────────
  previewUsers: any[] = [];
  previewTotal = 0;
  loadingPreview = false;

  // ── Usuarios de lista seleccionada ──────────────────────────
  listUsers: any[] = [];
  listUsersTotal = 0;
  loadingListUsers = false;
  listUsersPage = 0;
  listUsersLimit = 50;

  // ── Modal notificación push ─────────────────────────────────
  showPushModal = false;
  pushTitle = '';
  pushBody = '';
  sendingPush = false;
  pushSentCount = 0;
  pushErrorCount = 0;

  // ── Opciones de filtros ─────────────────────────────────────
  affiliationOptions = [
    { label: 'Todos', value: '' },
    { label: 'Cliente', value: 'cliente' },
    { label: 'Subcliente', value: 'subcliente' },
    { label: 'Socio', value: 'socio' },
    { label: 'Empleado', value: 'empleado' },
    { label: 'Técnico (empleado)', value: 'tecnico_empleado' },
    { label: 'Técnico (independiente)', value: 'tecnico_independiente' },
    { label: 'Otro', value: 'otro' },
  ];

  companyTypeOptions = [
    { label: 'Todos', value: '' },
    { label: 'Dealer', value: 'dealer' },
    { label: 'Rent a Car', value: 'rent_a_car' },
    { label: 'Financiera', value: 'financiera' },
    { label: 'Rastreo vehicular', value: 'rastreo_vehicular' },
  ];

  profileTypeOptions = [
    { label: 'Todos', value: '' },
    { label: 'Empresa', value: 'empresa' },
    { label: 'Personal', value: 'personal' },
    { label: 'Compartido', value: 'compartido' },
  ];

  statusOptions = [
    { label: 'Todos', value: null },
    { label: 'Activo', value: true },
    { label: 'Inactivo', value: false },
  ];

  constructor(
    private interaccionesService: InteraccionesService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private firebaseNotifications: FirebaseNotificationsService,
  ) {}

  ngOnInit() {
    this.loadLists();

    // Debounce el preview para no llamar en cada cambio de filtro
    this.previewTrigger$
      .pipe(debounceTime(400), takeUntil(this.destroy$))
      .subscribe(() => this.runPreview());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Cargar listas ─────────────────────────────────────────────────────

  loadLists() {
    this.loadingLists = true;
    this.interaccionesService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: (lists) => {
        this.lists = lists;
        this.loadingLists = false;
      },
      error: () => {
        this.loadingLists = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las listas' });
      }
    });
  }

  // ── Seleccionar lista ──────────────────────────────────────────────────

  selectList(list: UserList) {
    this.selectedList = list;
    this.showForm = false;
    this.listUsersPage = 0;
    this.loadListUsers();
  }

  loadListUsers() {
    if (!this.selectedList) return;
    this.loadingListUsers = true;
    this.interaccionesService
      .getUsersInList(this.selectedList._id, this.listUsersPage * this.listUsersLimit, this.listUsersLimit)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.listUsers = res.users;
          this.listUsersTotal = res.totalCount;
          this.loadingListUsers = false;
        },
        error: () => { this.loadingListUsers = false; }
      });
  }

  // ── Formulario nuevo/editar ──────────────────────────────────────────

  openNewForm() {
    this.isEditing = false;
    this.formName = '';
    this.formDescription = '';
    this.formFilters = {};
    this.previewUsers = [];
    this.previewTotal = 0;
    this.selectedList = null;
    this.showForm = true;
  }

  openEditForm(list: UserList) {
    this.isEditing = true;
    this.selectedList = list;
    this.formName = list.name;
    this.formDescription = list.description || '';
    this.formFilters = { ...list.filters };
    this.showForm = true;
    this.runPreview();
  }

  onFilterChange() {
    this.previewTrigger$.next();
  }

  runPreview() {
    // Build only non-empty filters
    const activeFilters: UserListFilters = {};
    if (this.formFilters.affiliation_type_id) activeFilters.affiliation_type_id = this.formFilters.affiliation_type_id;
    if (this.formFilters.company_type_id) activeFilters.company_type_id = this.formFilters.company_type_id;
    if (this.formFilters.profile_type_id) activeFilters.profile_type_id = this.formFilters.profile_type_id;
    if (this.formFilters.status !== undefined && this.formFilters.status !== null) {
      activeFilters.status = this.formFilters.status;
    }

    const hasFilters = Object.keys(activeFilters).length > 0;
    if (!hasFilters) {
      this.previewUsers = [];
      this.previewTotal = 0;
      return;
    }

    this.loadingPreview = true;
    this.interaccionesService.previewUsers(activeFilters).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.previewUsers = res.users;
        this.previewTotal = res.totalCount;
        this.loadingPreview = false;
      },
      error: () => { this.loadingPreview = false; }
    });
  }

  saveList() {
    if (!this.formName.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'El nombre es requerido' });
      return;
    }

    const activeFilters: UserListFilters = {};
    if (this.formFilters.affiliation_type_id) activeFilters.affiliation_type_id = this.formFilters.affiliation_type_id;
    if (this.formFilters.company_type_id) activeFilters.company_type_id = this.formFilters.company_type_id;
    if (this.formFilters.profile_type_id) activeFilters.profile_type_id = this.formFilters.profile_type_id;
    if (this.formFilters.status !== undefined && this.formFilters.status !== null) {
      activeFilters.status = this.formFilters.status;
    }

    this.savingForm = true;
    const payload = { name: this.formName, description: this.formDescription, filters: activeFilters };

    const op = this.isEditing
      ? this.interaccionesService.update(this.selectedList!._id, payload)
      : this.interaccionesService.create(payload);

    op.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.savingForm = false;
        this.showForm = false;
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: `Lista ${this.isEditing ? 'actualizada' : 'creada'} correctamente` });
        this.loadLists();
      },
      error: () => {
        this.savingForm = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar la lista' });
      }
    });
  }

  cancelForm() {
    this.showForm = false;
  }

  confirmDelete(list: UserList, event: Event) {
    this.confirmationService.confirm({
      message: `¿Eliminar la lista "${list.name}"? Esta acción no se puede deshacer.`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteList(list),
    });
  }

  deleteList(list: UserList) {
    this.interaccionesService.remove(list._id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        if (this.selectedList?._id === list._id) {
          this.selectedList = null;
          this.showForm = false;
        }
        this.messageService.add({ severity: 'success', summary: 'Eliminada', detail: `Lista "${list.name}" eliminada` });
        this.loadLists();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar la lista' })
    });
  }

  // ── Push Notification ─────────────────────────────────────────────────

  openPushModal() {
    this.pushTitle = '';
    this.pushBody = '';
    this.pushSentCount = 0;
    this.pushErrorCount = 0;
    this.showPushModal = true;
  }

  async sendPushToList() {
    if (!this.selectedList || !this.pushTitle.trim() || !this.pushBody.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Título y mensaje son requeridos' });
      return;
    }

    this.sendingPush = true;
    this.pushSentCount = 0;
    this.pushErrorCount = 0;

    // Obtener TODOS los usuarios de la lista (sin límite de paginación)
    const chunkSize = 100;
    let offset = 0;
    let totalFetched = 0;
    let totalUsers = this.listUsersTotal || 0;

    // Si aún no sabemos el total, cargamos un primer chunk
    if (totalUsers === 0) {
      const first = await this.interaccionesService
        .getUsersInList(this.selectedList._id, 0, chunkSize)
        .toPromise();
      totalUsers = first?.totalCount || 0;
    }

    while (offset < totalUsers || totalFetched === 0) {
      try {
        const res = await this.interaccionesService
          .getUsersInList(this.selectedList._id, offset, chunkSize)
          .toPromise();

        const users = res?.users || [];
        if (users.length === 0) break;

        for (const user of users) {
          const topic = user._id?.toString();
          if (!topic) { this.pushErrorCount++; continue; }

          try {
            await this.firebaseNotifications
              .sendTestNotification({ topic, title: this.pushTitle, body: this.pushBody })
              .toPromise();
            this.pushSentCount++;
          } catch {
            this.pushErrorCount++;
          }

          // Pequeña pausa para no saturar Firebase
          await new Promise(r => setTimeout(r, 60));
        }

        offset += users.length;
        totalFetched += users.length;
        if (users.length < chunkSize) break;
      } catch {
        break;
      }
    }

    this.sendingPush = false;
    this.showPushModal = false;
    this.messageService.add({
      severity: this.pushErrorCount === 0 ? 'success' : 'warn',
      summary: 'Notificaciones enviadas',
      detail: `Enviadas: ${this.pushSentCount} ✓  Errores: ${this.pushErrorCount}`,
      life: 6000,
    });
  }

  closePushModal() {
    if (!this.sendingPush) this.showPushModal = false;
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  getUserFullName(user: any): string {
    return `${user.name || ''} ${user.last_name || ''}`.trim();
  }

  getFilterBadges(list: UserList): string[] {
    const badges: string[] = [];
    if (list.filters?.affiliation_type_id) badges.push(list.filters.affiliation_type_id);
    if (list.filters?.company_type_id) badges.push(list.filters.company_type_id);
    if (list.filters?.profile_type_id) badges.push(list.filters.profile_type_id);
    if (list.filters?.status !== undefined && list.filters?.status !== null) {
      badges.push(list.filters.status ? 'Activo' : 'Inactivo');
    }
    return badges;
  }
}
