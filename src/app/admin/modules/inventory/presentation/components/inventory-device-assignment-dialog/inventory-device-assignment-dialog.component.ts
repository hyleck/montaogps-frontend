import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subject, Subscription, catchError, debounceTime, lastValueFrom, of, switchMap } from 'rxjs';
import { User } from 'src/app/core/interfaces/user.interface';
import {
  InventoryDeviceAssignmentResponse,
  InventoryItem,
  InventoryService,
} from 'src/app/core/services/inventory.service';
import { UserService } from 'src/app/core/services/user.service';
import { getApiErrorMessage } from 'src/app/core/utils/api-error.util';

@Component({
  selector: 'app-inventory-device-assignment-dialog',
  templateUrl: './inventory-device-assignment-dialog.component.html',
  styleUrls: ['./inventory-device-assignment-dialog.component.css'],
  standalone: false,
})
export class InventoryDeviceAssignmentDialogComponent
  implements OnInit, OnChanges, OnDestroy {
  @Input() visible = false;
  @Input() device: InventoryItem | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() assigned = new EventEmitter<InventoryDeviceAssignmentResponse>();

  intent: 'reserve' | 'install' | 'review' = 'install';
  clientQuery = '';
  clients: User[] = [];
  selectedClient: User | null = null;
  expirationDate = '';
  targetName = '';
  searchingClients = false;
  submitting = false;
  mainAccount: { _id: string; name?: string; last_name?: string; email?: string } | null = null;

  private readonly clientSearch$ = new Subject<string>();
  private clientSearchSubscription?: Subscription;

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly userService: UserService,
    private readonly messageService: MessageService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.clientSearchSubscription = this.clientSearch$
      .pipe(
        debounceTime(250),
        switchMap((query) => {
          this.searchingClients = true;
          return this.userService.searchSolicitudClients(query, 0, 30).pipe(
            catchError((error) => {
              this.messageService.add({
                severity: 'error',
                summary: 'No se pudieron cargar los clientes',
                detail: getApiErrorMessage(error, 'Intenta nuevamente.'),
              });
              return of({ users: [], totalCount: 0 });
            }),
          );
        }),
      )
      .subscribe((response) => {
        this.clients = response.users || [];
        this.searchingClients = false;
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.reset();
      this.loadMainAccount();
      this.clientSearch$.next('');
    }
  }

  ngOnDestroy(): void {
    this.clientSearchSubscription?.unsubscribe();
    this.clientSearch$.complete();
  }

  get imei(): string {
    return String(this.device?.IMEI || this.device?.imei || '').trim();
  }

  get protocolName(): string {
    const protocol = this.device?.Protocol || this.device?.protocol;
    return String(protocol?.name || 'GPS').trim();
  }

  get requiresClientSelection(): boolean {
    return this.intent !== 'review';
  }

  onClientQueryChange(): void {
    this.selectedClient = null;
    this.clientSearch$.next(this.clientQuery.trim());
  }

  selectClient(client: User): void {
    this.selectedClient = client;
    this.clientQuery = [client.name, client.last_name].filter(Boolean).join(' ').trim();
  }

  clearSelectedClient(): void {
    this.selectedClient = null;
    this.clientQuery = '';
    this.clientSearch$.next('');
  }

  close(): void {
    if (this.submitting) return;
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async submit(): Promise<void> {
    const missingClient = this.requiresClientSelection && !this.selectedClient?._id;
    if (!this.device?._id || missingClient || !this.expirationDate || this.submitting) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Completa los datos requeridos',
        detail: missingClient
          ? 'Selecciona un cliente y la fecha de vencimiento del servicio.'
          : 'Selecciona la fecha de vencimiento del servicio.',
      });
      return;
    }

    this.submitting = true;
    try {
      const response = await lastValueFrom(this.inventoryService.assignDeviceToClient(
        this.device._id,
        {
          clientId: this.requiresClientSelection ? this.selectedClient?._id : undefined,
          intent: this.intent,
          expirationDate: this.expirationDate,
          targetName: this.targetName.trim() || undefined,
        },
      ));
      if (!response?.device?._id) {
        throw new Error('El servidor no devolvió el objetivo reservado.');
      }
      const ownerId = String(
        response.device.parent_id
        || this.selectedClient?._id
        || '',
      ).trim();
      if (!ownerId) {
        throw new Error('El servidor no devolvió la cuenta asociada al objetivo.');
      }

      this.messageService.add({
        severity: 'success',
        summary: response.reused ? 'Reserva recuperada' : 'GPS reservado',
        detail: this.intent === 'install'
          ? 'Abriendo el registro de instalación en Management.'
          : this.intent === 'review'
            ? 'Abriendo la revisión de oficina en Management.'
            : 'El GPS quedó reservado para el cliente seleccionado.',
      });
      this.assigned.emit(response);
      this.visible = false;
      this.visibleChange.emit(false);

      await this.router.navigate(
        ['/admin/management/t', ownerId],
        {
          queryParams: {
            search: this.imei,
            inventoryTargetId: response.device._id,
            inventoryAction: this.intent,
          },
        },
      );
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo reservar el GPS',
        detail: getApiErrorMessage(error, 'Actualiza Inventario e intenta nuevamente.'),
      });
    } finally {
      this.submitting = false;
    }
  }

  private reset(): void {
    this.intent = 'install';
    this.clientQuery = '';
    this.clients = [];
    this.selectedClient = null;
    this.expirationDate = '';
    this.targetName = '';
    this.searchingClients = false;
    this.submitting = false;
  }

  private loadMainAccount(): void {
    this.userService.getMainAccount().subscribe({
      next: (response) => {
        this.mainAccount = response.account;
      },
      error: () => {
        this.mainAccount = null;
      },
    });
  }
}
