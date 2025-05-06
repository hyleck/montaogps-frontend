import { Component, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { ServersService } from '@core/services/servers.service';
import { Server, CreateServerDto, UpdateServerDto } from '@core/interfaces/server.interface';

@Component({
  selector: 'app-servers-settings',
  standalone: false,
  templateUrl: './servers-settings.component.html',
  styleUrl: './servers-settings.component.css'
})
export class ServersSettingsComponent implements OnInit {
  servers: Server[] = [];
  selectedServer: Server | null = null;
  isEditing: boolean = false;
  loading: boolean = false;

  serverForm = {
    _id: '',
    name: '',
    description: '',
    url: '',
    token: '',
    months_of_storage: 12,
    device_limit: 100,
    maintenance: false
  };

  constructor(
    private serversService: ServersService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    this.loadServers();
  }

  loadServers() {
    this.loading = true;
    this.serversService.getAllServers().subscribe({
      next: (servers: Server[]) => {
        this.servers = servers;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading servers:', error);
        this.showErrorMessage('error_loading');
        this.loading = false;
      }
    });
  }

  onSubmit() {
    if (this.isEditing && this.serverForm._id) {
      // Actualizar servidor existente
      const updateServerDto: UpdateServerDto = {
        name: this.serverForm.name,
        description: this.serverForm.description,
        url: this.serverForm.url,
        token: this.serverForm.token,
        months_of_storage: this.serverForm.months_of_storage,
        device_limit: this.serverForm.device_limit,
        maintenance: this.serverForm.maintenance
      };

      this.serversService.updateServer(this.serverForm._id, updateServerDto).subscribe({
        next: (updatedServer: Server) => {
          const index = this.servers.findIndex(server => server._id === this.serverForm._id);
          if (index !== -1) {
            this.servers[index] = updatedServer;
          }
          this.cancelEdit();
          this.showSuccessMessage('server_updated', updatedServer.name);
        },
        error: (error) => {
          console.error('Error updating server:', error);
          this.showErrorMessage('error_update');
        }
      });
    } else {
      // Crear nuevo servidor
      const createServerDto: CreateServerDto = {
        name: this.serverForm.name,
        description: this.serverForm.description,
        url: this.serverForm.url,
        token: this.serverForm.token,
        months_of_storage: this.serverForm.months_of_storage,
        device_limit: this.serverForm.device_limit,
        maintenance: this.serverForm.maintenance
      };

      this.serversService.createServer(createServerDto).subscribe({
        next: (createdServer: Server) => {
          this.servers.push(createdServer);
          this.cancelEdit();
          this.showSuccessMessage('server_created', createdServer.name);
        },
        error: (error) => {
          console.error('Error creating server:', error);
          this.showErrorMessage('error_create');
        }
      });
    }
  }

  editServer(server: Server) {
    this.selectedServer = server;
    this.serverForm = {...server};
    this.isEditing = true;
  }

  deleteServer(server: Server) {
    const message = this.translate.instant('settings.servers.messages.confirm_delete').replace('{name}', server.name);
    this.confirmationService.confirm({
      message: message,
      header: this.translate.instant('settings.servers.messages.confirm_delete_header'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('settings.servers.messages.yes_delete'),
      rejectLabel: this.translate.instant('settings.servers.messages.no_cancel'),
      accept: () => {
        this.serversService.deleteServer(server._id).subscribe({
          next: () => {
            const index = this.servers.findIndex(s => s._id === server._id);
            if (index !== -1) {
              this.servers.splice(index, 1);
            }
            this.showSuccessMessage('server_deleted', server.name);
          },
          error: (error) => {
            console.error('Error deleting server:', error);
            this.showErrorMessage('error_delete');
          }
        });
      }
    });
  }

  cancelEdit() {
    this.selectedServer = null;
    this.isEditing = false;
    this.serverForm = {
      _id: '',
      name: '',
      description: '',
      url: '',
      token: '',
      months_of_storage: 12,
      device_limit: 100,
      maintenance: false
    };
  }

  private showSuccessMessage(key: string, name: string) {
    const summary = this.translate.instant(`settings.servers.messages.${key}`);
    const detail = this.translate.instant(`settings.servers.messages.${key}_detail`).replace('{name}', name);
    
    this.messageService.add({
      severity: 'success',
      summary: summary,
      detail: detail
    });
  }

  private showErrorMessage(key: string) {
    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('settings.servers.messages.error'),
      detail: this.translate.instant(`settings.servers.messages.${key}`)
    });
  }
}
