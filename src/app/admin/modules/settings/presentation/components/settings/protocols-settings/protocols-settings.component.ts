import { Component, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { ProtocolsService } from '@core/services/protocols.service';
import { Protocol, CreateProtocolDto, UpdateProtocolDto, ProtocolCommand } from '@core/interfaces/protocol.interface';

@Component({
  selector: 'app-protocols-settings',
  standalone: false,
  templateUrl: './protocols-settings.component.html',
  styleUrl: './protocols-settings.component.css'
})
export class ProtocolsSettingsComponent implements OnInit {
  protocols: Protocol[] = [];
  isEditing: boolean = false;
  loading: boolean = false;

  // Formulario para nuevo comando
  newCommand: ProtocolCommand = {
    name: '',
    value: '',
    icon: 'pi-code'
  };

  protocolForm: Protocol = {
    _id: '',
    name: '',
    description: '',
    port: 0,
    img: '',
    commands: []
  };

  constructor(
    private protocolsService: ProtocolsService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadProtocols();
  }

  loadProtocols(): void {
    this.loading = true;
    this.protocolsService.getAllProtocols().subscribe({
      next: (protocols: Protocol[]) => {
        this.protocols = protocols;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading protocols:', error);
        this.showErrorMessage('error_loading');
        this.loading = false;
      }
    });
  }

  createProtocol(): void {
    this.resetForm();
    this.isEditing = false;
  }

  editProtocol(protocol: Protocol): void {
    this.protocolForm = {
      _id: protocol._id,
      name: protocol.name,
      description: protocol.description,
      port: protocol.port,
      img: protocol.img,
      commands: [...protocol.commands] // Clonamos el array de comandos
    };
    this.isEditing = true;
  }

  deleteProtocol(protocol: Protocol): void {
    this.confirmationService.confirm({
      message: this.translate.instant('settings.protocols.confirm_delete', { name: protocol.name }),
      header: this.translate.instant('settings.protocols.delete_header'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('settings.protocols.messages.yes_delete'),
      rejectLabel: this.translate.instant('settings.protocols.messages.no_cancel'),
      accept: () => {
        this.protocolsService.deleteProtocol(protocol._id).subscribe({
          next: () => {
            const index = this.protocols.findIndex(p => p._id === protocol._id);
            if (index !== -1) {
              this.protocols.splice(index, 1);
            }
            this.showSuccessMessage('deleted', protocol.name);
          },
          error: (error) => {
            console.error('Error deleting protocol:', error);
            this.showErrorMessage('error_delete');
          }
        });
      }
    });
  }

  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    if (this.isEditing && this.protocolForm._id) {
      // Actualizar protocolo existente
      const updateProtocolDto: UpdateProtocolDto = {
        name: this.protocolForm.name,
        description: this.protocolForm.description,
        port: this.protocolForm.port,
        img: this.protocolForm.img,
        commands: this.protocolForm.commands
      };

      this.protocolsService.updateProtocol(this.protocolForm._id, updateProtocolDto).subscribe({
        next: (updatedProtocol: Protocol) => {
          const index = this.protocols.findIndex(p => p._id === this.protocolForm._id);
          if (index !== -1) {
            this.protocols[index] = updatedProtocol;
          }
          this.cancelEdit();
          this.showSuccessMessage('updated', updatedProtocol.name);
        },
        error: (error) => {
          console.error('Error updating protocol:', error);
          this.showErrorMessage('error_update');
        }
      });
    } else {
      // Crear nuevo protocolo
      const createProtocolDto: CreateProtocolDto = {
        name: this.protocolForm.name,
        description: this.protocolForm.description,
        port: this.protocolForm.port,
        img: this.protocolForm.img,
        commands: this.protocolForm.commands
      };

      this.protocolsService.createProtocol(createProtocolDto).subscribe({
        next: (createdProtocol: Protocol) => {
          this.protocols.push(createdProtocol);
          this.cancelEdit();
          this.showSuccessMessage('created', createdProtocol.name);
        },
        error: (error) => {
          console.error('Error creating protocol:', error);
          this.showErrorMessage('error_create');
        }
      });
    }
  }

  cancelEdit(): void {
    this.resetForm();
  }

  resetForm(): void {
    this.protocolForm = {
      _id: '',
      name: '',
      description: '',
      port: 0,
      img: '',
      commands: []
    };
    this.resetNewCommand();
  }

  validateForm(): boolean {
    if (!this.protocolForm.name || this.protocolForm.port <= 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('settings.protocols.validation_error'),
        detail: this.translate.instant('settings.protocols.validation_fields')
      });
      return false;
    }
    return true;
  }

  // Métodos para gestionar comandos
  addCommand(): void {
    if (!this.validateCommand()) {
      return;
    }
    
    // Agregar el nuevo comando al protocolo actual
    this.protocolForm.commands.push({...this.newCommand});
    
    // Reiniciar el formulario de comando
    this.resetNewCommand();
  }

  resetNewCommand(): void {
    this.newCommand = {
      name: '',
      value: '',
      icon: 'pi-code'
    };
  }

  removeCommand(index: number): void {
    this.protocolForm.commands.splice(index, 1);
  }

  validateCommand(): boolean {
    if (!this.newCommand.name || !this.newCommand.value) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('settings.protocols.validation_error'),
        detail: this.translate.instant('settings.protocols.command_fields_required')
      });
      return false;
    }
    return true;
  }

  // Métodos auxiliares para mensajes
  showSuccessMessage(key: string, name: string): void {
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant(`settings.protocols.${key}`),
      detail: this.translate.instant(`settings.protocols.${key}_success`, { name })
    });
  }

  showErrorMessage(key: string): void {
    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('settings.protocols.messages.error'),
      detail: this.translate.instant(`settings.protocols.messages.${key}`)
    });
  }
}
