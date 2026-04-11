import { Component, OnInit, OnDestroy } from '@angular/core';
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
  formObjectives: { id: string; title: string; tempId?: number }[] = [];

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
    private userService: UserService
  ) {}

  systemContacts: any[] = [];
  chatwootAgentId: string = '';

  ngOnInit() {
    this.loadAgentId();
    this.loadLists();
    this.loadSystemContacts();

    // Debounce el preview para no llamar en cada cambio de filtro
    this.previewTrigger$
      .pipe(debounceTime(400), takeUntil(this.destroy$))
      .subscribe(() => this.runPreview());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
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
    if (this.formFilters.exclude_notified) activeFilters.exclude_notified = true;

    const hasFilters = Object.keys(activeFilters).length > 0;
    const hasExternal = this.formExternalContacts.some(c => c.name.trim() !== '');

    if (!hasFilters && !hasExternal) {
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

    this.savingForm = true;
    const validExternal = this.formExternalContacts.filter(c => c.name.trim() !== '');
    const validObjectives = this.formObjectives.filter(o => o.title.trim() !== '').map(o => {
      return { id: o.id || Math.random().toString(36).substr(2, 9), title: o.title.trim() };
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
  interactionChannel: 'push' | 'email' | 'whatsapp' = 'push';

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

  addObjective() {
    this.formObjectives.push({ id: Math.random().toString(36).substr(2, 9), title: '' });
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

  openPersonalPushModal(user: any, channel: 'push' | 'email' | 'whatsapp' = 'push') {
    this.targetUserId = user._id;
    this.targetUserName = this.getUserFullName(user);
    this.targetUserEmail = user.email || null;
    this.targetUserPhone = user.phone || null;
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
          if (this.interactionChannel === 'whatsapp') {
            const phone = user.phone;
            if (!phone) { this.pushErrorCount++; continue; }
            try {
              await this.interaccionesService.sendWhatsAppToUser({
                phone: phone,
                template_name: 'simple_mensaje',
                // Si está en masa y dejaron el comodín, lo reemplazamos. Si escribieron otra cosa, lo usamos literal
                variables: [
                  this.whatsappTemplateVars.headerUser,
                  this.whatsappTemplateVars.bodySaludos,
                  this.whatsappTemplateVars.name === '[Nombre del usuario]' ? this.toTitleCase(this.getUserFullName(user)) : this.whatsappTemplateVars.name, 
                  this.whatsappTemplateVars.body
                ],
                agent_id: this.chatwootAgentId ? this.chatwootAgentId : undefined
              }).toPromise();
              this.pushSentCount++;
              successIds.push(user._id.toString());
            } catch {
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
                agent_id: this.chatwootAgentId ? this.chatwootAgentId : undefined
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

    if (successIds.length > 0) {
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

    this.sendingPush = false;
    this.showPushModal = false;
    this.messageService.add({
      severity: this.pushErrorCount === 0 ? 'success' : 'warn',
      summary: 'Notificaciones enviadas',
      detail: `Enviadas: ${this.pushSentCount} ✓  Errores: ${this.pushErrorCount}`,
      life: 6000,
    });
  }

  async sendPersonalPush() {
    this.sendingPush = true;
    this.pushSentCount = 0;
    this.pushErrorCount = 0;
    
    try {
      let isSuccess = false;
      
      if (this.interactionChannel === 'whatsapp') {
         if (!this.targetUserPhone) throw new Error('El usuario no tiene teléfono configurado');
         await this.interaccionesService.sendWhatsAppToUser({
        phone: this.targetUserPhone,
        template_name: 'simple_mensaje',
        variables: [
          this.whatsappTemplateVars.headerUser,
          this.whatsappTemplateVars.bodySaludos,
          this.whatsappTemplateVars.name,
          this.whatsappTemplateVars.body
        ],
        agent_id: this.chatwootAgentId ? this.chatwootAgentId : undefined
      }).toPromise();
         isSuccess = true;
      } else if (this.interactionChannel === 'email') {
         if (!this.targetUserEmail) throw new Error('El usuario no tiene correo electrónico configurado');
         await this.interaccionesService.sendEmailToUser({
           email: this.targetUserEmail,
           subject: this.pushTitle,
           message: this.getDefaultEmailMarkdown(this.pushBody),
           contact_name: this.targetUserName || undefined,
           agent_id: this.chatwootAgentId ? this.chatwootAgentId : undefined
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
          if (this.interactionChannel === 'email') {
            prefix = '';
            finalTitle = 'Mensaje enviado por correo';
          } else if (this.interactionChannel === 'whatsapp') {
            finalTitle = `Mensaje enviado por WhatsApp`;
            finalBody = `B${this.whatsappTemplateVars.bodySaludos}, ${this.whatsappTemplateVars.name}.\n${this.whatsappTemplateVars.body}\n\nSeguimos a tu orden por este número.\nMontao GPS`;
          }
          await this.interaccionesService.logCampaignUsers(this.selectedList!._id, {
            userIds: [this.targetUserId!],
            title: prefix + finalTitle,
            body: finalBody
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
}
