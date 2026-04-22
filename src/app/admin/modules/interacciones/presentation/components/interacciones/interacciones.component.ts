import { Component, OnInit, OnDestroy } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { InteraccionesService, UserList, UserListFilters } from '../../services/interacciones.service';
import { MessageService, ConfirmationService } from 'primeng/api';
import { FirebaseNotificationsService } from '@core/services/firebase-notifications.service';
import { SystemService } from '@core/services/system.service';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';

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
  filteredLists: UserList[] = [];
  searchTerm: string = '';
  selectedList: UserList | null = null;
  loadingLists = false;

  // ── Panel de creación/edición ───────────────────────────────
  showForm = false;
  isEditing = false;
  savingForm = false;

  formName = '';
  formDescription = '';
  formFilters: UserListFilters = {};
  formExternalContacts: any[] = [];
  formObjectives: any[] = [];
  formSystemContacts: any[] = [];
  suggestedSystemUsers: any[] = [];

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
  vapiQuery = '';
  sendingPush = false;
  pushSentCount = 0;
  pushErrorCount = 0;

  // ── Historial de Usuario ────────────────────────────────────
  showHistoryModal = false;
  selectedUserHistory: any = null;

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
    private systemService: SystemService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private userService: UserService,
    private sanitizer: DomSanitizer
  ) {}

  systemContacts: any[] = [];
  chatwootAgentId: string = '';
  assignToEster: boolean = false;

  // ── Manual Interactions ───────────────────────────────────────
  showManualInteractionModal: boolean = false;
  showAutocontactWarning: boolean = false;
  manualInteractionType: string = '';
  manualInteractionNotes: string = '';
  savingManualInteraction: boolean = false;
  manualInteractionTypes: any[] = [
    { label: 'Visita Presencial', value: 'Visita Presencial', icon: 'pi pi-map-marker' },
    { label: 'Revisión de Dispositivos', value: 'Revisión de Dispositivos', icon: 'pi pi-wrench' },
    { label: 'Llamada Manual', value: 'Llamada Manual', icon: 'pi pi-phone' },
    { label: 'Mensaje de WhatsApp Manual', value: 'Mensaje de WhatsApp Manual', icon: 'pi pi-whatsapp' },
    { label: 'Correo Electrónico Manual', value: 'Correo Electrónico Manual', icon: 'pi pi-envelope' },
    { label: 'Otra (Interacción Indirecta)', value: 'Otra (Interacción Indirecta)', icon: 'pi pi-ellipsis-h' }
  ];

  // ── Email Inboxes ───────────────────────────────────────────
  emailInboxes: { id: number, name: string, email: string }[] = [];
  selectedEmailInbox: number | null = null;

  // ── WhatsApp Quotas ─────────────────────────────────────────
  whatsappQuota = { limit: 1000, count: 0, available: 1000 };

  ngOnInit() {
    this.loadSystemSettings();
    this.loadAgentId();
    this.loadLists();
    this.loadSystemContacts();
    this.loadEmailInboxes();

    // Debounce el preview para no llamar en cada cambio de filtro
    this.previewTrigger$
      .pipe(debounceTime(400), takeUntil(this.destroy$))
      .subscribe(() => this.runPreview());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSystemSettings() {
    this.systemService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res && res.length > 0) {
          const quota = res[0].whatsapp_quota;
          if (quota) {
            const today = new Date().toISOString().split('T')[0];
            if (quota.date === today) {
                this.whatsappQuota.limit = quota.limit || 1000;
                this.whatsappQuota.count = quota.count || 0;
                this.whatsappQuota.available = Math.max(0, this.whatsappQuota.limit - this.whatsappQuota.count);
            }
          }
        }
      },
      error: (e) => console.log('Error cargando system settings', e)
    });
  }

  loadSystemContacts() {
    this.systemService.getPublic().pipe(takeUntil(this.destroy$)).subscribe({
      next: (systems) => {
        if (systems && systems.length > 0) {
          this.systemContacts = systems[0].contacts || [];
        }
      }
    });
  }

  loadEmailInboxes() {
    this.interaccionesService.getEmailInboxes().pipe(takeUntil(this.destroy$)).subscribe({
      next: (inboxes) => {
        this.emailInboxes = inboxes || [];
        if (this.emailInboxes.length > 0) {
          // Set the first one as default
          this.selectedEmailInbox = this.emailInboxes[0].id;
        }
      },
      error: (e) => console.log('Error loading email inboxes', e)
    });
  }

  loadAgentId() {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.id) {
      this.userService.getById(currentUser.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: (user: any) => {
          this.chatwootAgentId = user?.idchatwoot || '';
        }
      });
    }
  }

  getContactLink(contact: any): string {
    const value = contact.value || '';
    const type = contact.type || '';
    if (type === 'teléfono' || type === 'telefono' || value.includes('(')) {
      const cleanNumber = value.replace(/[^\d]/g, '');
      return `https://wa.me/${cleanNumber}`;
    } else if (type === 'correo' || value.includes('@')) {
      return `mailto:${value}`;
    } else if (type === 'enlace' || value.startsWith('http')) {
      return value.startsWith('http') ? value : `https://${value}`;
    }
    if (/^\d/.test(value)) {
      const cleanNumber = value.replace(/[^\d]/g, '');
      return `https://wa.me/${cleanNumber}`;
    }
    return value;
  }

  getDefaultEmailMarkdown(bodyText: string): string {
    let header = `### **Montao GPS**\n\n${bodyText}\n\n`;
    let footer = `---\n**Canales de Contacto:**\n`;
    if (this.systemContacts && this.systemContacts.length > 0) {
      for (const contact of this.systemContacts) {
        const type = contact.type || 'Contacto';
        const value = contact.value || '';
        const link = this.getContactLink(contact);
        footer += `- [${type}: ${value}](${link})\n`;
      }
    } else {
      footer += `- No hay contactos configurados\n`;
    }
    return `${header}${footer}`;
  }

  // ── Cargar listas ─────────────────────────────────────────────────────

  loadLists() {
    this.loadingLists = true;
    this.interaccionesService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: (lists) => {
        this.lists = lists;
        this.filterLists();
        this.loadingLists = false;

        const listId = this.route.snapshot.queryParamMap.get('listId');
        if (listId) {
          const found = this.lists.find(l => l._id === listId);
          if (found) {
            this.selectedList = found;
            this.showForm = false;
            this.listUsersPage = 0;
            this.loadListUsers();
          }
        }
      },
      error: () => {
        this.loadingLists = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las listas' });
      }
    });
  }

  filterLists() {
    if (!this.searchTerm.trim()) {
      this.filteredLists = [...this.lists];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredLists = this.lists.filter(l =>
        l.name.toLowerCase().includes(term) ||
        (l.description && l.description.toLowerCase().includes(term))
      );
    }
  }

  // ── Seleccionar lista ──────────────────────────────────────────────────

  selectList(list: UserList) {
    this.selectedList = list;
    this.showForm = false;
    this.listUsersPage = 0;
    this.loadListUsers();

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { listId: list._id },
      queryParamsHandling: 'merge'
    });
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
    this.formExternalContacts = [];
    this.formObjectives = [];
    this.formSystemContacts = [];
    this.suggestedSystemUsers = [];
    this.previewUsers = [];
    this.previewTotal = 0;
    this.selectedList = null;
    this.showForm = true;
    this.clearUrlParam();
  }

  openEditForm(list: UserList) {
    this.isEditing = true;
    this.selectedList = list;
    this.formName = list.name;
    this.formDescription = list.description || '';
    this.formFilters = { ...list.filters };
    this.formExternalContacts = list.external_contacts ? JSON.parse(JSON.stringify(list.external_contacts)) : [];
    this.formObjectives = list.objectives ? JSON.parse(JSON.stringify(list.objectives)) : [];
    this.formSystemContacts = [];
    if (this.formFilters.manual_user_ids?.length) {
      this.formFilters.manual_user_ids.forEach((id: string) => {
        this.userService.getById(id).pipe(takeUntil(this.destroy$)).subscribe({
          next: (u) => { if (u) this.formSystemContacts.push(u); }
        });
      });
    }
    this.showForm = true;
    this.runPreview();
  }

  addExternalContact() {
    this.formExternalContacts.push({ name: '', phone: '', email: '' });
    this.onFilterChange();
  }

  removeExternalContact(index: number) {
    this.formExternalContacts.splice(index, 1);
    this.onFilterChange();
  }

  searchSystemUsers(event: any) {
    this.userService.search(event.query, undefined, 0, 10).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.suggestedSystemUsers = res.users;
      }
    });
  }

  onFilterChange() {
    if (this.formSystemContacts && this.formSystemContacts.length > 0) {
      this.formFilters.manual_user_ids = this.formSystemContacts.map((u: any) => u._id);
    } else {
      this.formFilters.manual_user_ids = [];
    }
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
    if (this.formFilters.exclude_notified) activeFilters.exclude_notified = true;
    if (this.formFilters.force_empty) activeFilters.force_empty = true;
    if (this.formFilters.manual_user_ids?.length) activeFilters.manual_user_ids = this.formFilters.manual_user_ids;

    const hasFilters = Object.keys(activeFilters).length > 0;
    const hasExternal = this.formExternalContacts.some(c => c.name.trim() !== '');

    if (!hasFilters && !hasExternal && (!this.formFilters.manual_user_ids || this.formFilters.manual_user_ids.length === 0)) {
      this.previewUsers = [];
      this.previewTotal = 0;
      return;
    }

    this.loadingPreview = true;
    this.interaccionesService.previewUsers(activeFilters, this.selectedList?._id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        let mockedExternal = this.formExternalContacts
          .filter(c => c.name.trim() !== '')
          .map(c => ({ _id: 'ext_' + Math.random().toString(36).substr(2, 9), name: c.name, phone: c.phone, email: c.email, is_external: true }));
        this.previewUsers = [...res.users, ...mockedExternal];
        this.previewTotal = res.totalCount + mockedExternal.length;
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
    if (this.formFilters.exclude_notified) activeFilters.exclude_notified = true;
    if (this.formFilters.force_empty) activeFilters.force_empty = true;
    if (this.formFilters.manual_user_ids?.length) activeFilters.manual_user_ids = this.formFilters.manual_user_ids;

    this.savingForm = true;
    const validExternal = this.formExternalContacts.filter(c => c.name.trim() !== '');
    const validObjectives = this.formObjectives.filter(o => o.title.trim() !== '').map(o => {
      const obj: any = { id: o.id || Math.random().toString(36).substr(2, 9), title: o.title.trim() };
      if (o.description && o.description.trim() !== '') obj.description = o.description.trim();
      return obj;
    });
    const payload: any = { name: this.formName, description: this.formDescription, filters: activeFilters, external_contacts: validExternal, objectives: validObjectives };

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
          this.clearUrlParam();
        }
        this.messageService.add({ severity: 'success', summary: 'Eliminada', detail: `Lista "${list.name}" eliminada` });
        this.loadLists();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar la lista' })
    });
  }

  clearUrlParam() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { listId: null },
      queryParamsHandling: 'merge'
    });
  }

  // ── Push Notification ─────────────────────────────────────────────────

  openPushModal() {
    this.targetUserId = null;
    this.targetUserName = null;
    this.targetUserEmail = null;
    this.pushTitle = '';
    this.pushBody = '';
    this.pushSentCount = 0;
    this.pushErrorCount = 0;
    
    // Auto-completado de WhatsApp
    const currentUser = this.authService.getCurrentUser();
    this.whatsappTemplateVars.headerUser = currentUser ? this.toTitleCase((currentUser.name || '') + ' ' + (currentUser.last_name || '')).trim() || 'Soporte' : 'Soporte';
    this.whatsappTemplateVars.bodySaludos = this.getDominicanTimeGreeting();
    this.whatsappTemplateVars.name = '[Nombre del usuario]'; // Indicador dinámico
    this.whatsappTemplateVars.body = '';
    
    this.showPushModal = true;
  }

  showChecklistModal = false;
  selectedChecklistUser: any = null;
  selectedChecklistCompletedCount = 0;
  selectedChecklistTotal = 0;

  openChecklistModal(user: any) {
    this.selectedChecklistUser = user;
    this.calculateChecklistStats();
    this.showChecklistModal = true;
  }

  closeChecklistModal() {
    this.showChecklistModal = false;
    this.selectedChecklistUser = null;
  }

  getCompletedObjectivesCount(user: any): number {
    if (!user || !this.selectedList?.objectives?.length) return 0;
    if (user.is_external) {
      return user.completed_objectives?.filter((id: string) => this.selectedList!.objectives!.some(o => o.id === id)).length || 0;
    }
    const listProgress = user.interaction_progress?.find((p: any) => p.listId === this.selectedList!._id);
    if (!listProgress) return 0;
    return listProgress.completed_objectives.filter((id: string) => this.selectedList!.objectives!.some(o => o.id === id)).length;
  }

  calculateChecklistStats() {
    this.selectedChecklistTotal = this.selectedList?.objectives?.length || 0;
    this.selectedChecklistCompletedCount = this.getCompletedObjectivesCount(this.selectedChecklistUser);
  }

  targetUserId: string | null = null;
  targetUserName: string | null = null;
  targetUserEmail: string | null = null;
  targetUserPhone: string | null = null;
  targetUserIsExternal: boolean = false;
  targetUserAutocontact: boolean | null = null;
  interactionChannel: 'push' | 'email' | 'whatsapp' | 'vapi' = 'push';

  // WhatsApp Variables Mad-Libs style
  whatsappTemplateVars = { headerUser: '', bodySaludos: '', name: '', body: '' };

  toTitleCase(str: string): string {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  getDominicanTimeGreeting(): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Santo_Domingo',
      hour: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const hourString = parts.find(p => p.type === 'hour')?.value;
    const hour = parseInt(hourString || '12', 10);

    if (hour >= 5 && hour < 12) {
      return 'uenos días';
    } else if (hour >= 12 && hour < 19) {
      return 'uenas tardes';
    } else {
      return 'uenas noches';
    }
  }

  removeUserFromList(user: any) {
    if (!this.selectedList) return;

    if (user.is_external) {
      this.selectedList.external_contacts = this.selectedList.external_contacts?.filter(c => c._id !== user._id) || [];
      this.interaccionesService.update(this.selectedList._id, { external_contacts: this.selectedList.external_contacts } as any).subscribe(() => {
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Contacto externo removido' });
        this.loadLists();
      });
      return;
    }

    const filters = this.selectedList.filters;
    let modified = false;

    // Remove from manual_user_ids if it's there
    if (filters.manual_user_ids && filters.manual_user_ids.includes(user._id)) {
      filters.manual_user_ids = filters.manual_user_ids.filter((id: string) => id !== user._id);
      modified = true;
    } else {
      // Add to excluded_user_ids if it's a dynamic user
      if (!filters.excluded_user_ids) filters.excluded_user_ids = [];
      if (!filters.excluded_user_ids.includes(user._id)) {
        filters.excluded_user_ids.push(user._id);
        modified = true;
      }
    }

    if (modified) {
      // Optimistic update
      this.listUsers = this.listUsers.filter(u => u._id !== user._id);
      // We trigger a save (which will also refresh data properly via DB)
      this.interaccionesService.update(this.selectedList._id, { filters: this.selectedList.filters }).subscribe(() => {
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Usuario removido de la campaña' });
      });
    }
  }

  addObjective() {
    this.formObjectives.push({ id: Math.random().toString(36).substring(2, 11), title: '', description: '' });
  }

  removeObjective(index: number) {
    this.formObjectives.splice(index, 1);
  }

  onObjectiveToggle(user: any, objectiveId: string, event: any) {
    if (!this.selectedList || !user._id) return;
    const isChecked = event.checked;

    if (user.is_external) {
      if (!user.completed_objectives) user.completed_objectives = [];
      if (isChecked && !user.completed_objectives.includes(objectiveId)) user.completed_objectives.push(objectiveId);
      if (!isChecked) user.completed_objectives = user.completed_objectives.filter((id: string) => id !== objectiveId);

      this.interaccionesService.toggleExternalInteractionProgress(this.selectedList._id, user._id, objectiveId, isChecked)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el progreso' })
        });
    } else {
      // Optimistic UI Update against User tracking logic
      if (!user.interaction_progress) user.interaction_progress = [];
      const listProgress = user.interaction_progress.find((p: any) => p.listId === this.selectedList!._id);
      if (listProgress) {
        if (isChecked && !listProgress.completed_objectives.includes(objectiveId)) listProgress.completed_objectives.push(objectiveId);
        if (!isChecked) listProgress.completed_objectives = listProgress.completed_objectives.filter((id: string) => id !== objectiveId);
      } else if (isChecked) {
        user.interaction_progress.push({ listId: this.selectedList._id, completed_objectives: [objectiveId] });
      }

      this.userService.toggleInteractionProgress(user._id, this.selectedList._id, objectiveId, isChecked)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el progreso' })
        });
    }

    if (this.showChecklistModal && this.selectedChecklistUser?._id === user._id) {
      this.calculateChecklistStats();
    }
  }

  isObjectiveCompleted(user: any, objectiveId: string): boolean {
    if (!user) return false;
    if (user.is_external) {
      return user.completed_objectives?.includes(objectiveId) || false;
    }

    if (!user.interaction_progress || !user.interaction_progress.length) return false;
    const listProgress = user.interaction_progress.find((p: any) => p.listId === this.selectedList?._id);
    if (!listProgress) return false;
    return listProgress.completed_objectives.includes(objectiveId);
  }

  openPersonalPushModal(user: any, channel: 'push' | 'email' | 'whatsapp' | 'vapi' = 'push') {
    this.targetUserId = user._id;
    this.targetUserName = this.getUserFullName(user);
    this.targetUserEmail = user.email || null;
    this.targetUserPhone = user.phone || null;
    this.targetUserIsExternal = !!user.is_external;
    this.targetUserAutocontact = user.autocontact !== undefined ? user.autocontact : null;
    this.interactionChannel = channel;
    this.pushTitle = '';
    this.pushBody = '';
    this.pushSentCount = 0;
    this.pushErrorCount = 0;
    this.showPushModal = true;

    if (channel === 'whatsapp') {
      const currentUser = this.authService.getCurrentUser();
      this.whatsappTemplateVars.headerUser = currentUser ? this.toTitleCase((currentUser.name || '') + ' ' + (currentUser.last_name || '')).trim() || 'Soporte' : 'Soporte';
      this.whatsappTemplateVars.bodySaludos = this.getDominicanTimeGreeting();
      this.whatsappTemplateVars.name = this.toTitleCase(this.targetUserName || '');
    }
  }

  async sendPushToList() {
    if (this.interactionChannel === 'whatsapp') {
      if (!this.whatsappTemplateVars.name.trim() || !this.whatsappTemplateVars.body.trim()) {
        this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Debe rellenar todas las variables de la plantilla' });
        return;
      }
    } else if (this.interactionChannel === 'vapi') {
      if (!this.vapiQuery.trim()) {
        this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'El motivo de la llamada es requerido' });
        return;
      }
    } else {
      if (!this.selectedList || !this.pushTitle.trim() || !this.pushBody.trim()) {
        this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Título y mensaje son requeridos' });
        return;
      }
    }

    if (this.targetUserId) {
      this.sendPersonalPush();
      return;
    }

    this.sendingPush = true;
    this.pushSentCount = 0;
    this.pushErrorCount = 0;
    const successIds: string[] = [];

    // Obtener TODOS los usuarios de la lista (sin límite de paginación)
    const chunkSize = 100;
    let offset = 0;
    let totalFetched = 0;
    let totalUsers = this.listUsersTotal || 0;

    // Si aún no sabemos el total, cargamos un primer chunk
    if (totalUsers === 0) {
      const first = await this.interaccionesService
        .getUsersInList(this.selectedList!._id, 0, chunkSize)
        .toPromise();
      totalUsers = first?.totalCount || 0;
    }

    while (offset < totalUsers || totalFetched === 0) {
      try {
        const res = await this.interaccionesService
          .getUsersInList(this.selectedList!._id, offset, chunkSize)
          .toPromise();

        const users = res?.users || [];
        if (users.length === 0) break;

        for (const user of users) {
          // Si el usuario tiene explícitamente autocontact en false, no se envían campañas automatizadas de estos tipos
          if (user.autocontact === false && ['whatsapp', 'vapi', 'email'].includes(this.interactionChannel)) {
            console.warn(`[CAMPAIGN] Omitiendo a "${user.name || user._id}" porque autocontact = false`);
            continue;
          }

          if (this.interactionChannel === 'whatsapp') {
            const phone = user.phone;
            if (!phone) { console.warn('[WA-CAMPAIGN] User sin teléfono:', user._id, user.name); this.pushErrorCount++; continue; }
            try {
              console.log(`[WA-CAMPAIGN] Enviando a: "${phone}" | Usuario: ${user.name || user._id}`);
              const res = await this.interaccionesService.sendWhatsAppToUser({
                phone: phone,
                template_name: 'simple',
                // Template 'simple' (Utility): header (user) + body (saludos, name, body) = 4 params
                variables: [
                  this.whatsappTemplateVars.headerUser,
                  this.whatsappTemplateVars.bodySaludos,
                  this.whatsappTemplateVars.name === '[Nombre del usuario]' ? this.toTitleCase(this.getUserFullName(user)) : this.whatsappTemplateVars.name, 
                  this.whatsappTemplateVars.body
                ],
                agent_id: this.assignToEster ? '0' : (this.chatwootAgentId ? this.chatwootAgentId : undefined)
              }).toPromise();
              console.log(`[WA-CAMPAIGN] Respuesta para "${phone}":`, JSON.stringify(res));
              if (res && res.success === false) {
                 console.error('[WA-CAMPAIGN] Meta API Error:', res.error);
                 throw new Error(res.error);
              }
              this.pushSentCount++;
              successIds.push(user._id.toString());
            } catch (err: any) {
              console.error(`[WA-CAMPAIGN] ❌ Falló para "${phone}":`, err?.message || err);
              this.pushErrorCount++;
            }
          } else if (this.interactionChannel === 'vapi') {
            const phone = user.phone;
            if (!phone) { this.pushErrorCount++; continue; }
            try {
              console.log(`[VAPI-CAMPAIGN] Llamando a: "${phone}"`);
              const res = await this.interaccionesService.sendVapiCall({
                phone: phone,
                query: this.vapiQuery,
                name: this.toTitleCase(this.getUserFullName(user)),
                listId: this.selectedList?._id,
                userId: user._id,
                isExternal: !!user.is_external,
                objectives: this.selectedList?.objectives?.map((o: any) => ({ id: o.id, title: o.title }))
              }).toPromise();
              if (res && res.success === false) throw new Error(res.error);
              
              this.pushSentCount++;
              successIds.push(user._id.toString());

              // Log inmediato con callId para que el historial tenga el ID de VAPI asociado
              const vapiCallId = res?.data?.id || null;
              try {
                await this.interaccionesService.logCampaignUsers(this.selectedList!._id, {
                  userIds: [user._id.toString()],
                  title: 'Llamada de IA (Ester) Iniciada',
                  body: `Motivo: ${this.vapiQuery}`,
                  callId: vapiCallId
                }).toPromise();
              } catch (logErr) {
                console.error('[VAPI-CAMPAIGN] Error logging individual call history', logErr);
              }

              // Esperar 30 segundos usando delay según requerimiento
              await new Promise(r => setTimeout(r, 30000));
            } catch (err) {
              this.pushErrorCount++;
            }
          } else if (this.interactionChannel === 'email') {
            const email = user.email;
            if (!email) { this.pushErrorCount++; continue; }
            try {
              await this.interaccionesService.sendEmailToUser({
                email: email,
                subject: this.pushTitle,
                message: this.getDefaultEmailMarkdown(this.pushBody),
                contact_name: this.getUserFullName(user),
                agent_id: this.chatwootAgentId ? this.chatwootAgentId : undefined,
                inbox_id: this.selectedEmailInbox || undefined
              }).toPromise();
              this.pushSentCount++;
              successIds.push(user._id.toString());
            } catch {
              this.pushErrorCount++;
            }
          } else {
            if (user.is_external) {
              console.warn('Skipping Push Notification for External Contact', user.name);
              continue;
            }
            const topic = user._id?.toString();
            if (!topic) { this.pushErrorCount++; continue; }

            try {
              await this.firebaseNotifications
                .sendTestNotification({ topic, title: this.pushTitle, body: this.pushBody })
                .toPromise();
              this.pushSentCount++;
              successIds.push(topic);
            } catch {
              this.pushErrorCount++;
            }
          }

          // Pequeña pausa para no saturar APIs
          await new Promise(r => setTimeout(r, 60));
        }

        offset += users.length;
        totalFetched += users.length;
        if (users.length < chunkSize) break;
      } catch {
        break;
      }
    }

    if (successIds.length > 0 && this.interactionChannel !== 'vapi') {
      try {
        let prefix = '';
        let finalTitle = this.pushTitle;
        let finalBody = this.pushBody;
        if (this.interactionChannel === 'email') {
          prefix = '';
          finalTitle = 'Mensaje enviado por correo';
        } else if (this.interactionChannel === 'whatsapp') {
          finalTitle = `Mensaje enviado por WhatsApp`;
          finalBody = `B${this.whatsappTemplateVars.bodySaludos}, ${this.whatsappTemplateVars.name === '[Nombre del usuario]' ? 'Usuario' : this.whatsappTemplateVars.name}.\n${this.whatsappTemplateVars.body}\n\nSeguimos a tu orden por este número.\nMontao GPS`;
        }
        await this.interaccionesService.logCampaignUsers(this.selectedList!._id, {
          userIds: successIds,
          title: prefix + finalTitle,
          body: finalBody
        }).toPromise();
        
        // Reload list to update the notified users array for preview
        this.loadLists();
      } catch (e) {
        console.error('Error logging campaign history', e);
      }
    }

    // Para VAPI, recargar las listas (ya se loguearon individualmente arriba)
    if (this.interactionChannel === 'vapi' && successIds.length > 0) {
      this.loadLists();
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

  async sendPersonalPush(force = false) {
    if (!force && this.targetUserAutocontact === false && ['whatsapp', 'vapi', 'email'].includes(this.interactionChannel)) {
      this.showAutocontactWarning = true;
      return;
    }

    this.sendingPush = true;
    this.pushSentCount = 0;
    this.pushErrorCount = 0;
    try {

      let isSuccess = false;
      
      if (this.interactionChannel === 'whatsapp') {
         if (!this.targetUserPhone) throw new Error('El usuario no tiene teléfono configurado');
         const res = await this.interaccionesService.sendWhatsAppToUser({
        phone: this.targetUserPhone,
        template_name: 'simple',
        variables: [
          this.whatsappTemplateVars.headerUser,
          this.whatsappTemplateVars.bodySaludos,
          this.whatsappTemplateVars.name,
          this.whatsappTemplateVars.body
        ],
        agent_id: this.assignToEster ? '0' : (this.chatwootAgentId ? this.chatwootAgentId : undefined)
      }).toPromise();
      if (res && res.success === false) {
         console.error('Meta API Error:', res.error);
         throw new Error(res.error);
      }
          isSuccess = true;
      } else if (this.interactionChannel === 'vapi') {
         if (!this.targetUserPhone) throw new Error('El usuario no tiene teléfono configurado');
         const res = await this.interaccionesService.sendVapiCall({
           phone: this.targetUserPhone,
           query: this.vapiQuery,
           name: this.targetUserName || 'Usuario',
           listId: this.selectedList?._id,
           userId: this.targetUserId || undefined,
           isExternal: this.targetUserIsExternal,
           objectives: this.selectedList?.objectives?.map((o: any) => ({ id: o.id, title: o.title }))
         }).toPromise();
         if (res && res.success === false) throw new Error(res.error);
         isSuccess = true;
         (this as any)._lastVapiCallId = res?.data?.id || null;
      } else if (this.interactionChannel === 'email') {
         if (!this.targetUserEmail) throw new Error('El usuario no tiene correo electrónico configurado');
         await this.interaccionesService.sendEmailToUser({
           email: this.targetUserEmail,
           subject: this.pushTitle,
           message: this.getDefaultEmailMarkdown(this.pushBody),
           contact_name: this.targetUserName || undefined,
           agent_id: this.chatwootAgentId ? this.chatwootAgentId : undefined,
           inbox_id: this.selectedEmailInbox || undefined
         }).toPromise();
         isSuccess = true;
      } else {
         await this.firebaseNotifications
           .sendTestNotification({ topic: this.targetUserId!, title: this.pushTitle, body: this.pushBody })
           .toPromise();
         isSuccess = true;
      }
      
      if (isSuccess) {
        this.pushSentCount = 1;
        // Registrar en el historial de la lista seleccionada
        try {
          let prefix = '';
          let finalTitle = this.pushTitle;
          let finalBody = this.pushBody;
          let callId: string | undefined;
          if (this.interactionChannel === 'email') {
            prefix = '';
            finalTitle = 'Mensaje enviado por correo';
          } else if (this.interactionChannel === 'whatsapp') {
            finalTitle = `Mensaje enviado por WhatsApp`;
            finalBody = `B${this.whatsappTemplateVars.bodySaludos}, ${this.whatsappTemplateVars.name}.\n${this.whatsappTemplateVars.body}\n\nSeguimos a tu orden por este número.\nMontao GPS`;
          } else if (this.interactionChannel === 'vapi') {
            finalTitle = `Llamada de IA (Ester) Iniciada`;
            finalBody = `Motivo: ${this.vapiQuery}`;
            callId = (this as any)._lastVapiCallId;
          }
          await this.interaccionesService.logCampaignUsers(this.selectedList!._id, {
            userIds: [this.targetUserId!],
            title: prefix + finalTitle,
            body: finalBody,
            callId
          }).toPromise();
          this.loadLists();
        } catch (e) {
          console.error('Error logging personal history', e);
        }
        
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Interacción enviada al usuario.' });
      }
    } catch (err) {
      this.pushErrorCount = 1;
      const errorDetail = (err as any)?.error?.message || 'No se pudo enviar la notificación personal.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: errorDetail });
    } finally {
      this.sendingPush = false;
      this.closePushModal();
    }
  }

  closePushModal() {
    if (!this.sendingPush) {
      this.showPushModal = false;
      this.targetUserId = null;
      this.targetUserName = null;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  getUserFullName(user: any): string {
    return this.toTitleCase(`${user.name || ''} ${user.last_name || ''}`.trim());
  }

  getFilterBadges(list: UserList): string[] {
    const badges: string[] = [];
    if (list.filters?.affiliation_type_id) badges.push(list.filters.affiliation_type_id);
    if (list.filters?.company_type_id) badges.push(list.filters.company_type_id);
    if (list.filters?.profile_type_id) badges.push(list.filters.profile_type_id);
    if (list.filters?.status !== undefined && list.filters?.status !== null) {
      badges.push(list.filters.status ? 'Activo' : 'Inactivo');
    }
    if (list.filters?.exclude_notified) badges.push('No Notificados');
    if (list.filters?.force_empty) badges.push('Manual / Vacía');
    return badges;
  }

  // ── Historial ──

  getUserHistory(userId: string): any {
    if (!this.selectedList || !this.selectedList.notified_users) return null;
    
    // Encontrar todas las entradas para este usuario (en caso de duplicaciones por errores de _id parsing)
    const entries = this.selectedList.notified_users.filter(nu => String(nu.userId) === String(userId));
    if (!entries || entries.length === 0) return null;

    if (entries.length === 1) return entries[0];

    // Fusiones en tiempo real para historiales paralelos
    const mergedHistory: any[] = [];
    let totalCount = 0;
    let latestDate = new Date(0);

    for (const entry of entries) {
      if (entry.history && Array.isArray(entry.history)) {
        mergedHistory.push(...entry.history);
      } else if (entry.last_sent_at) { // Fallback para data vieja
        mergedHistory.push({ title: 'Notificación enviada', body: 'Mensaje de campaña', sentAt: entry.last_sent_at });
      }
      totalCount += (entry.notification_count || 1);
      
      const d = entry.last_sent_at ? new Date(entry.last_sent_at) : new Date(0);
      if (d > latestDate) latestDate = d;
    }

    // Ordenar cronológicamente (más antiguo al más reciente) para que el p-timeline lo muestre con el último abajo
    mergedHistory.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

    return {
      userId,
      notification_count: totalCount,
      last_sent_at: latestDate,
      history: mergedHistory
    };
  }

  getLastInteractionType(hist: any): string {
    if (!hist || !hist.history || hist.history.length === 0) return 'Notificación push';
    const lastItem = hist.history[hist.history.length - 1];
    if (lastItem && lastItem.title) {
      if (lastItem.title.includes('[Email]') || lastItem.title.includes('correo con el siguiente contenido') || lastItem.title.includes('Mensaje enviado por correo')) {
        return 'Correo electrónico';
      }
      if (lastItem.title.includes('[WhatsApp]') || lastItem.title.includes('Mensaje enviado por WhatsApp')) {
        return 'WhatsApp';
      }
      if (lastItem.title.includes('Llamada de IA') || lastItem.title.includes('Ester')) {
        return 'Llamada IA (Ester)';
      }
      if (lastItem.title.includes('Revisión de Dispositivos')) {
        return 'Revisión de Dispositivos';
      }
      // Si el título no coincide con ninguno conocido, usarlo directamente
      if (lastItem.title && !lastItem.title.includes('Notificación')) {
        return lastItem.title;
      }
    }
    return 'Notificación push';
  }

  getLastInteractionIcon(hist: any): string {
    if (!hist || !hist.history || hist.history.length === 0) return 'pi-bell';
    const lastItem = hist.history[hist.history.length - 1];
    if (lastItem && lastItem.title) {
      if (lastItem.title.includes('[Email]') || lastItem.title.includes('correo con el siguiente contenido') || lastItem.title.includes('Mensaje enviado por correo')) {
        return 'pi-envelope';
      }
      if (lastItem.title.includes('[WhatsApp]') || lastItem.title.includes('Mensaje enviado por WhatsApp')) {
        return 'pi-whatsapp text-green-500';
      }
      if (lastItem.title.includes('Llamada de IA') || lastItem.title.includes('Ester')) {
        return 'pi-phone';
      }
      if (lastItem.title.includes('Revisión de Dispositivos')) {
        return 'pi-wrench';
      }
    }
    return 'pi-bell';
  }

  parseBasicMarkdown(text: string): string {
    if (!text) return '';
    let parsed = text;
    // Escapar HTML básico
    parsed = parsed.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // ### Headers
    parsed = parsed.replace(/^### (.*$)/gim, '<h3 style="margin-top:0.5rem; margin-bottom:0.5rem;">$1</h3>');
    // **bold**
    parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    // hr
    parsed = parsed.replace(/^---$/gim, '<hr style="margin: 0.5rem 0;">');
    // Lists
    parsed = parsed.replace(/^- (.*)$/gim, '<li style="margin-left: 1.5rem;">$1</li>');
    // Links [text](url)
    parsed = parsed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #6366f1; text-decoration: underline;">$1</a>');
    // Newlines -> <br> except after block elements
    parsed = parsed.replace(/\n\n/g, '<br><br>');
    parsed = parsed.replace(/\n(?!\s*<br>|\s*<|---)/g, '<br>');
    return `<div class="md-preview" style="font-family: inherit; font-size: 0.95rem; line-height: 1.5; color: var(--text-color);">${parsed}</div>`;
  }

  formatTranscript(transcript: string): { isAI: boolean; text: string }[] {
    if (!transcript) return [];
    // Split by newlines, each line starts with "AI: " or "User: "
    const lines = transcript.split('\n').filter(l => l.trim());
    return lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('AI:')) {
        return { isAI: true, text: trimmed.replace(/^AI:\s*/, '') };
      } else if (trimmed.startsWith('User:')) {
        return { isAI: false, text: trimmed.replace(/^User:\s*/, '') };
      }
      // Fallback: treat as AI if unknown
      return { isAI: true, text: trimmed };
    });
  }

  openUserHistory(userId: string) {
    const historyData = this.getUserHistory(userId);
    if (historyData) {
      // Revertimos la constante historia para mostrar cronología descendente si el usuario prefiere lo nuevo arriba
      // pero por ahora pasamos tal cual al timeline
      let hList = historyData.history ? [...historyData.history] : [];
      if (hList.length === 0 && historyData.last_sent_at) {
        hList = [{ title: 'Notificación enviada', body: 'Mensaje de campaña', sentAt: historyData.last_sent_at }];
      }
      
      // Invertir para que la última quede arriba en el UI si es la preferencia,
      // Pero actualmente la UI asume el orden del backend
      // Haremos un sort descendente para UX sin mutar la referencia original.
      hList.sort((a: any, b: any) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

      this.selectedUserHistory = { ...historyData, history: hList };
      this.showHistoryModal = true;
    }
  }

  saveObservation(item: any) {
    if (!this.selectedList || !this.selectedUserHistory) return;
    item._savingObservation = true;
    this.interaccionesService.saveInteractionObservation(
      this.selectedList._id,
      this.selectedUserHistory.userId,
      item._id,
      item.observation || ''
    ).subscribe({
      next: (res) => {
        item._savingObservation = false;
        item._editObservation = false;
        this.messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Observación guardada' });
      },
      error: (err) => {
        item._savingObservation = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar la observación' });
      }
    });
  }

  openManualInteractionModal() {
    this.manualInteractionType = this.manualInteractionTypes[0].value;
    this.manualInteractionNotes = '';
    this.showManualInteractionModal = true;
  }

  saveManualInteraction() {
    if (!this.selectedList || !this.selectedUserHistory || !this.manualInteractionType) return;
    this.savingManualInteraction = true;

    const payload = {
      userIds: [this.selectedUserHistory.userId],
      title: this.manualInteractionType,
      body: this.manualInteractionNotes || 'Interacción manual registrada',
      sentAt: new Date()
    };

    this.interaccionesService.logCampaignUsers(this.selectedList._id, payload).subscribe({
      next: () => {
        this.savingManualInteraction = false;
        this.showManualInteractionModal = false;
        this.messageService.add({ severity: 'success', summary: 'Registrado', detail: 'Interacción manual registrada con éxito' });
        
        // Optimistic UI update for timeline
        this.selectedUserHistory!.notification_count = (this.selectedUserHistory!.notification_count || 0) + 1;
        this.selectedUserHistory!.history.unshift({
          title: payload.title,
          body: payload.body,
          sentAt: payload.sentAt,
          observation: ''
        });
      },
      error: () => {
        this.savingManualInteraction = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar la interacción manual' });
      }
    });
  }

  loadCallRecording(item: any) {
    if (!item.callId || item._loadingRecording) return;
    item._loadingRecording = true;
    this.interaccionesService.getVapiCallRecording(item.callId).subscribe({
      next: (res: any) => {
        item._loadingRecording = false;
        if (res.success && res.recordingUrl) {
          item.recordingUrl = this.sanitizer.bypassSecurityTrustUrl(res.recordingUrl);
          item.transcript = res.transcript || item.transcript;
          item._callStatus = res.status;
          item._callDuration = res.duration;
        } else {
          item._recordingError = res.status === 'ended' ? 'La grabación aún se está procesando. Intenta en unos minutos.' : (res.error || 'Llamada aún en curso...');
        }
      },
      error: (err: any) => {
        item._loadingRecording = false;
        item._recordingError = 'Error consultando VAPI';
      }
    });
  }
}
