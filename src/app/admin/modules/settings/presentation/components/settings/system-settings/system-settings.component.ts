import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

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
  logo: string;
  logoFile: File | null;
  logoPreview: string | null;
  company_name: string;
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
    contacts: [],
    downloads: [],
    sim_api1: { name: '', url: '', key: '' },
    sim_api2: { name: '', url: '', key: '' },
    map_api1: { name: '', url: '', key: '' },
    map_api2: { name: '', url: '', key: '' }
  };

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
    console.log('Form submit', this.form);
    // Aquí se podría manejar la subida del archivo
    if (this.form.logoFile) {
      console.log('Logo file to upload:', this.form.logoFile);
      // TODO: Implementar lógica para subir el archivo al servidor
    }
    // TODO: enviar datos al backend o servicio.
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }

  constructor(private translateService: TranslateService) {}

  ngOnInit() {
    // Initialize any additional setup if needed
  }
}
