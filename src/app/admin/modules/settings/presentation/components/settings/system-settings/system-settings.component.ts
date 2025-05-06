import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { SystemService, SystemSettings } from '@app/core/services/system.service';
import { finalize } from 'rxjs/operators';

interface ContactEntry {
  id: string;
  name: string;
  description: string;
  value: string;
  icon: string;
  type: string;
}

interface DownloadEntry {
  id: string;
  name: string;
  description: string;
  value: string;
  icon: string;
  type: string;
}

interface SimApiConfig {
  name: string;
  url: string;
  key: string;
}

interface SystemSettingsForm {
  _id?: string;
  logo: string;
  logoFile: File | null;
  logoPreview: string | null;
  company_name: string;
  phone: string;
  contacts: ContactEntry[];
  downloads: DownloadEntry[];
  sim_api1: SimApiConfig;
  sim_api2: SimApiConfig;
  map_api1: SimApiConfig;
  map_api2: SimApiConfig;
}

@Component({
  selector: 'app-system-settings',
  standalone: false,
  templateUrl: './system-settings.component.html',
  styleUrl: './system-settings.component.css'
})
export class SystemSettingsComponent implements OnInit {
  form: SystemSettingsForm = {
    logo: '',
    logoFile: null,
    logoPreview: null,
    company_name: '',
    phone: '',
    contacts: [],
    downloads: [],
    sim_api1: { name: '', url: '', key: '' },
    sim_api2: { name: '', url: '', key: '' },
    map_api1: { name: '', url: '', key: '' },
    map_api2: { name: '', url: '', key: '' }
  };

  loading: boolean = false;
  saving: boolean = false;
  existingSystem: SystemSettings | null = null;

  // Opciones para los dropdowns
  contactTypeOptions = [
    { label: 'Teléfono', value: 'teléfono' },
    { label: 'Correo', value: 'correo' },
    { label: 'Enlace', value: 'enlace' }
  ];

  downloadTypeOptions = [
    { label: 'Web', value: 'web' },
    { label: 'PDF', value: 'pdf' },
    { label: 'Hoja de cálculo', value: 'hoja de calculo' },
    { label: 'Imagen', value: 'imagen' },
    { label: 'Otro archivo', value: 'otro archivo' }
  ];

  // Variables para modales de contactos
  contactModalVisible = false;
  contactModalTitle = '';
  currentContact: any = {};
  editingContactIndex: number = -1;

  // Variables para modales de descargas
  downloadModalVisible = false;
  downloadModalTitle = '';
  currentDownload: any = {};
  editingDownloadIndex: number = -1;

  constructor(
    private translateService: TranslateService,
    private systemService: SystemService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.loadSystemSettings();
  }

  loadSystemSettings() {
    this.loading = true;
    this.systemService.getAll()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (systems) => {
          if (systems && systems.length > 0) {
            this.existingSystem = systems[0];
            this.populateForm(this.existingSystem);
          }
        },
        error: (error) => {
          console.error('Error al cargar las configuraciones del sistema', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('settings.system.error_loading'),
            detail: this.translateService.instant('settings.system.error_loading_detail')
          });
        }
      });
  }

  populateForm(system: SystemSettings) {
    this.form = {
      _id: system._id,
      logo: system.logo || '',
      logoFile: null,
      logoPreview: system.logo || null,
      company_name: system.company_name,
      phone: system.phone || '',
      contacts: system.contacts || [],
      downloads: system.downloads || [],
      sim_api1: system.sim_api1 || { name: '', url: '', key: '' },
      sim_api2: system.sim_api2 || { name: '', url: '', key: '' },
      map_api1: system.map_api1 || { name: '', url: '', key: '' },
      map_api2: system.map_api2 || { name: '', url: '', key: '' }
    };
  }

  // Método para manejar la selección de archivo de imagen para el logo
  onLogoFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type.match(/image\/*/) !== null) {
      this.form.logoFile = file;
      
      // Crear URL para vista previa
      const reader = new FileReader();
      reader.onload = () => {
        this.form.logoPreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  // Método para eliminar la imagen seleccionada
  clearLogo() {
    this.form.logoFile = null;
    this.form.logoPreview = null;
    this.form.logo = '';
  }

  // Métodos para contactos
  showContactModal() {
    this.contactModalTitle = this.translateService.instant('settings.system.add_contact');
    this.currentContact = {
      id: this.generateId(),
      name: '',
      description: '',
      value: '',
      type: '',
      icon: 'pi-user'
    };
    this.editingContactIndex = -1;
    this.contactModalVisible = true;
  }

  editContact(index: number) {
    this.contactModalTitle = this.translateService.instant('settings.system.edit_contact');
    this.currentContact = { ...this.form.contacts[index] };
    this.editingContactIndex = index;
    this.contactModalVisible = true;
  }

  saveContact() {
    if (this.editingContactIndex >= 0) {
      this.form.contacts[this.editingContactIndex] = { ...this.currentContact };
    } else {
      this.form.contacts.push({ ...this.currentContact });
    }
    this.contactModalVisible = false;
  }

  removeContact(index: number) {
    this.form.contacts.splice(index, 1);
  }

  // Métodos para descargas
  showDownloadModal() {
    this.downloadModalTitle = this.translateService.instant('settings.system.add_download');
    this.currentDownload = {
      id: this.generateId(),
      name: '',
      description: '',
      value: '',
      type: '',
      icon: 'pi-download'
    };
    this.editingDownloadIndex = -1;
    this.downloadModalVisible = true;
  }

  editDownload(index: number) {
    this.downloadModalTitle = this.translateService.instant('settings.system.edit_download');
    this.currentDownload = { ...this.form.downloads[index] };
    this.editingDownloadIndex = index;
    this.downloadModalVisible = true;
  }

  saveDownload() {
    if (this.editingDownloadIndex >= 0) {
      this.form.downloads[this.editingDownloadIndex] = { ...this.currentDownload };
    } else {
      this.form.downloads.push({ ...this.currentDownload });
    }
    this.downloadModalVisible = false;
  }

  removeDownload(index: number) {
    this.form.downloads.splice(index, 1);
  }

  onSubmit() {
    this.saving = true;
    
    // Primero subir el logo si hay uno nuevo
    if (this.form.logoFile) {
      this.systemService.uploadLogo(this.form.logoFile)
        .pipe(finalize(() => {}))
        .subscribe({
          next: (response) => {
            this.form.logo = response.url;
            this.saveSystemSettings();
          },
          error: (error) => {
            console.error('Error al subir el logo', error);
            this.messageService.add({
              severity: 'error',
              summary: this.translateService.instant('settings.system.error_upload_logo'),
              detail: this.translateService.instant('settings.system.error_upload_logo_detail')
            });
            // Continuar con el guardado sin logo
            this.saveSystemSettings();
          }
        });
    } else {
      this.saveSystemSettings();
    }
  }

  saveSystemSettings() {
    // Crear el objeto SystemSettings a partir del formulario
    const systemData: SystemSettings = {
      company_name: this.form.company_name,
      phone: this.form.phone,
      logo: this.form.logo,
      contacts: this.form.contacts,
      downloads: this.form.downloads,
      sim_api1: this.form.sim_api1,
      sim_api2: this.form.sim_api2,
      map_api1: this.form.map_api1,
      map_api2: this.form.map_api2
    };

    if (this.existingSystem && this.existingSystem._id) {
      // Actualizar sistema existente
      this.systemService.update(this.existingSystem._id, systemData)
        .pipe(finalize(() => this.saving = false))
        .subscribe({
          next: (updatedSystem) => {
            this.existingSystem = updatedSystem;
            this.messageService.add({
              severity: 'success',
              summary: this.translateService.instant('settings.system.update_success'),
              detail: this.translateService.instant('settings.system.update_success_detail')
            });
          },
          error: (error) => {
            console.error('Error al actualizar la configuración del sistema', error);
            this.messageService.add({
              severity: 'error',
              summary: this.translateService.instant('settings.system.error_update'),
              detail: this.translateService.instant('settings.system.error_update_detail')
            });
          }
        });
    } else {
      // Crear nuevo sistema
      this.systemService.create(systemData)
        .pipe(finalize(() => this.saving = false))
        .subscribe({
          next: (newSystem) => {
            this.existingSystem = newSystem;
            this.form._id = newSystem._id;
            this.messageService.add({
              severity: 'success',
              summary: this.translateService.instant('settings.system.create_success'),
              detail: this.translateService.instant('settings.system.create_success_detail')
            });
          },
          error: (error) => {
            console.error('Error al crear la configuración del sistema', error);
            this.messageService.add({
              severity: 'error',
              summary: this.translateService.instant('settings.system.error_create'),
              detail: this.translateService.instant('settings.system.error_create_detail')
            });
          }
        });
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }
  
  // Método para llenar el formulario con datos de ejemplo
  fillWithTestData() {
    const logoUrl = 'https://montaogps.com/assets/images/logo-montao-gps.png';
    
    this.form = {
      _id: this.form._id,
      logo: logoUrl,
      logoFile: null,
      logoPreview: logoUrl,
      company_name: 'Montao GPS Internacional',
      phone: '+1 (555) 123-4567',
      contacts: [
        {
          id: this.generateId(),
          name: 'Soporte Técnico',
          description: 'Línea de atención 24/7',
          value: '+1 (555) 123-4567',
          icon: 'pi-phone',
          type: 'teléfono'
        },
        {
          id: this.generateId(),
          name: 'Email Ventas',
          description: 'Contacto para adquisición de servicios',
          value: 'ventas@montaogps.com',
          icon: 'pi-envelope',
          type: 'correo'
        },
        {
          id: this.generateId(),
          name: 'Sitio Web',
          description: 'Visita nuestro sitio web',
          value: 'https://www.montaogps.com',
          icon: 'pi-globe',
          type: 'enlace'
        }
      ],
      downloads: [
        {
          id: this.generateId(),
          name: 'Manual de Usuario',
          description: 'Guía completa de uso del sistema',
          value: 'https://www.montaogps.com/docs/manual.pdf',
          icon: 'pi-file-pdf',
          type: 'pdf'
        },
        {
          id: this.generateId(),
          name: 'Aplicación móvil',
          description: 'Descarga nuestra app para Android',
          value: 'https://play.google.com/store/apps/montaogps',
          icon: 'pi-android',
          type: 'web'
        }
      ],
      sim_api1: {
        name: 'SIM Cloud API',
        url: 'https://api.simcloud.com/v2',
        key: 'sk_test_12345abcdef67890'
      },
      sim_api2: {
        name: 'SIM Track Connect',
        url: 'https://sim-track.io/api',
        key: 'api_key_9876543210abcdef'
      },
      map_api1: {
        name: 'Google Maps API',
        url: 'https://maps.googleapis.com/maps/api',
        key: 'AIzaSyBhJ7Z9Q3ExAmPLE12345'
      },
      map_api2: {
        name: 'Mapbox API',
        url: 'https://api.mapbox.com/v4',
        key: 'pk.eyJ1IjoibW9udGFvIiwiYSI6ImNqZXhhbXBsZTEyMzQ1Njc4OTAifQ.Example'
      }
    };

    this.messageService.add({
      severity: 'info',
      summary: this.translateService.instant('settings.system.test_data_loaded'),
      detail: this.translateService.instant('settings.system.test_data_loaded_detail')
    });
  }
}
