import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { getApiErrorMessage } from '../core/utils/api-error.util';
import {
  getIdentityDocumentNumber,
  getIdentityDocumentType,
  hasCompleteIdentityData,
  isValidIdentityDocument,
} from '../core/utils/identity-document.util';
import { UserService, PublicRegistrationInfo } from '../core/services/user.service';
import { PrimengModule } from '../shareds/libraries/primeng/primeng.module';

@Component({
  selector: 'app-public-registration',
  templateUrl: './public-registration.component.html',
  styleUrls: ['./public-registration.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PrimengModule
  ]
})
export class PublicRegistrationComponent implements OnInit {
  token = '';
  loading = true;
  submitting = false;
  scanningIdentity = false;
  identityScanned = false;
  completed = false;
  info: PublicRegistrationInfo | null = null;
  errorMessage = '';
  identityFile: File | null = null;
  identityPreviewUrl = '';
  identityScanData: any = null;
  identityScanError = '';
  visibleRegistrationFields = new Set<string>();
  detectedDevicePlatform: 'android' | 'iphone' | '' = '';

  form: any = {
    name: '',
    last_name: '',
    email: '',
    phone: '',
    dni: '',
    identity_document_type: '',
    identity_document_number: '',
    address: '',
    province: '',
    municipality: '',
    password: '',
    confirm_password: '',
    registration_device_platform: ''
  };

  constructor(
    private route: ActivatedRoute,
    private userService: UserService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    this.detectedDevicePlatform = this.detectRegistrationDevicePlatform();
    this.form.registration_device_platform = this.detectedDevicePlatform;
    this.loadInfo();
  }

  loadInfo(): void {
    this.loading = true;
    this.errorMessage = '';
    this.userService.getPublicRegistrationInfo(this.token).subscribe({
      next: (info) => {
        this.info = info;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Este link de registro no es valido o ya expiro.';
        this.loading = false;
      }
    });
  }

  onIdentityFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.identityFile = file;
    this.identityScanError = '';
    this.identityScanData = null;

    if (this.identityPreviewUrl) {
      URL.revokeObjectURL(this.identityPreviewUrl);
      this.identityPreviewUrl = '';
    }

    if (file) {
      this.identityPreviewUrl = URL.createObjectURL(file);
      this.scanIdentity();
    }
  }

  scanIdentity(): void {
    if (!this.identityFile || this.scanningIdentity) return;

    this.scanningIdentity = true;
    this.identityScanError = '';
    this.userService.scanPublicRegistrationIdentity(this.token, this.identityFile).subscribe({
      next: (response) => {
        this.scanningIdentity = false;
        const data = response?.data || {};
        this.identityScanData = data;

        if (!isValidIdentityDocument(data)) {
          this.identityScanned = false;
          this.identityScanError = data.mensaje_usuario || 'La imagen no parece ser una cédula o un pasaporte. Sube una foto clara del documento.';
          return;
        }

        if (!this.hasCompleteIdentityData(data)) {
          this.identityScanned = false;
          this.visibleRegistrationFields.clear();
          this.identityScanError = 'No se pudieron leer claramente los datos del documento. Sube una foto más clara donde se vea completo el nombre, apellido y número.';
          return;
        }

        this.identityScanned = true;
        this.fillFormFromIdentity(data);
        this.prepareVisibleRegistrationFields();
        if (this.usesLinkedPhone()) {
          // El enlace entregado por la solicitud ya está ligado al WhatsApp del
          // cliente. Tras leer un documento válido, completar el registro es seguro
          // y no requiere otro dato manual.
          queueMicrotask(() => this.submit());
        }
      },
      error: (error) => {
        this.scanningIdentity = false;
        this.identityScanned = false;
        this.identityScanError = error?.error?.message || 'No se pudo escanear el documento de identidad. Intenta con una foto más clara.';
      }
    });
  }

  resetIdentityScan(): void {
    this.identityScanned = false;
    this.identityScanData = null;
    this.identityScanError = '';
    this.identityFile = null;
    this.visibleRegistrationFields.clear();
    if (this.identityPreviewUrl) {
      URL.revokeObjectURL(this.identityPreviewUrl);
      this.identityPreviewUrl = '';
    }
  }

  private fillFormFromIdentity(data: any): void {
    const nombres = this.cleanText(data?.nombres);
    const apellidos = this.cleanText(data?.apellidos);
    const documentNumber = getIdentityDocumentNumber(data);
    const documentType = getIdentityDocumentType(data);
    const direccion = this.cleanText(data?.direccion);
    const provincia = this.cleanText(data?.provincia);
    const municipio = this.cleanText(data?.municipio);

    if (nombres) this.form.name = this.toTitleCase(nombres);
    if (apellidos) this.form.last_name = this.toTitleCase(apellidos);
    if (documentNumber) {
      this.form.dni = documentNumber;
      this.form.identity_document_number = documentNumber;
    }
    if (documentType) this.form.identity_document_type = documentType;
    if (direccion) this.form.address = direccion;
    if (provincia) this.form.province = this.toTitleCase(provincia);
    if (municipio) this.form.municipality = this.toTitleCase(municipio);
  }

  showRegistrationField(field: string): boolean {
    return this.visibleRegistrationFields.has(field);
  }

  private prepareVisibleRegistrationFields(): void {
    this.visibleRegistrationFields.clear();
    if (this.usesLinkedPhone()) {
      return;
    }
    this.visibleRegistrationFields.add('phone');
    if (!this.detectedDevicePlatform) {
      this.visibleRegistrationFields.add('registration_device_platform');
    }
  }

  private hasCompleteIdentityData(data: any): boolean {
    return hasCompleteIdentityData(data);
  }

  usesLinkedPhone(): boolean {
    return this.info?.uses_linked_phone === true;
  }

  private isFieldEmpty(field: string): boolean {
    return !String(this.form?.[field] ?? '').trim();
  }

  private cleanText(value: any): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toTitleCase(value: string): string {
    return value
      .toLocaleLowerCase('es-DO')
      .replace(/\p{L}[\p{L}'-]*/gu, word => word.charAt(0).toLocaleUpperCase('es-DO') + word.slice(1));
  }

  private detectRegistrationDevicePlatform(): 'android' | 'iphone' | '' {
    const userAgent = `${navigator.userAgent || ''} ${navigator.platform || ''}`.toLowerCase();
    if (/android/.test(userAgent)) return 'android';
    if (/iphone|ipad|ipod/.test(userAgent)) return 'iphone';
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'iphone';
    return '';
  }

  submit(): void {
    if (this.submitting || this.completed) return;
    if (!this.form.name || !this.form.last_name || !this.form.dni) {
      this.messageService.add({ severity: 'warn', summary: 'Documento incompleto', detail: 'No se pudieron leer todos los datos del documento. Sube una foto más clara.' });
      return;
    }
    if (!this.usesLinkedPhone() && !this.form.phone) {
      this.messageService.add({ severity: 'warn', summary: 'Datos incompletos', detail: 'Completa el teléfono.' });
      return;
    }
    if (!this.usesLinkedPhone() && !this.form.registration_device_platform) {
      this.messageService.add({ severity: 'warn', summary: 'Selecciona tu dispositivo', detail: 'Indica si instalarás Montao GPS en Android o iPhone.' });
      return;
    }

    if (this.usesLinkedPhone() && !this.form.registration_device_platform) {
      this.form.registration_device_platform = 'android';
    }

    this.submitting = true;
    this.userService.registerWithPublicLink(this.token, this.form).subscribe({
      next: () => {
        this.completed = true;
        this.submitting = false;
        this.messageService.add({ severity: 'success', summary: 'Cuenta creada', detail: 'Tu cuenta fue registrada correctamente.' });
      },
      error: (error) => {
        this.submitting = false;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo registrar',
          detail: getApiErrorMessage(error, 'No se pudo registrar la cuenta')
        });
      }
    });
  }
}
