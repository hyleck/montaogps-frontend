import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { UserService, PublicIdentityVerificationInfo } from '../core/services/user.service';
import { getApiErrorMessage } from '../core/utils/api-error.util';
import {
  getIdentityDocumentLabel,
  getIdentityDocumentNumber,
  hasCompleteIdentityData,
  isValidIdentityDocument,
} from '../core/utils/identity-document.util';
import { PrimengModule } from '../shareds/libraries/primeng/primeng.module';

@Component({
  selector: 'app-public-identity-verification',
  templateUrl: './public-identity-verification.component.html',
  styleUrls: ['./public-identity-verification.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PrimengModule
  ]
})
export class PublicIdentityVerificationComponent implements OnInit, OnDestroy {
  token = '';
  loading = true;
  scanning = false;
  finalizing = false;
  completed = false;
  info: PublicIdentityVerificationInfo | null = null;
  errorMessage = '';
  scanError = '';
  identityFile: File | null = null;
  previewUrl = '';
  scanData: Record<string, any> | null = null;

  constructor(
    private route: ActivatedRoute,
    private userService: UserService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    this.loadInfo();
  }

  ngOnDestroy(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
  }

  loadInfo(): void {
    this.loading = true;
    this.errorMessage = '';
    this.userService.getPublicIdentityVerificationInfo(this.token).subscribe({
      next: (info) => {
        this.info = info;
        this.loading = false;
        this.completed = info.user.verificado === true;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Este link de verificación no es válido o ya expiró.';
        this.loading = false;
      }
    });
  }

  onIdentityFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = '';
    this.scanError = '';
    this.scanData = null;
    this.identityFile = file;

    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = '';
    }

    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.scanError = 'Debe subir una imagen clara de la cédula o el pasaporte.';
      return;
    }

    this.previewUrl = URL.createObjectURL(file);
    this.scanIdentity(file);
  }

  scanIdentity(file: File): void {
    if (this.scanning) return;
    this.scanning = true;
    this.scanError = '';

    this.userService.scanPublicIdentityVerification(this.token, file).subscribe({
      next: (response) => {
        this.scanning = false;
        this.scanData = response?.data || null;

        if (!isValidIdentityDocument(this.scanData)) {
          this.scanError = this.scanData?.['mensaje_usuario']
            || 'La imagen no parece ser una cédula o un pasaporte. Sube una foto clara del documento.';
          return;
        }

        if (!this.hasCompleteIdentityData(this.scanData)) {
          this.scanError = 'No se pudieron leer claramente los datos del documento. Sube una foto donde se vea completo el nombre, apellido y número.';
          this.scanData = null;
          return;
        }

        this.messageService.add({
          severity: 'success',
          summary: 'Documento digitalizado',
          detail: 'Estamos verificando tu cuenta automáticamente.',
          life: 3000
        });
        this.finalize();
      },
      error: (error) => {
        this.scanning = false;
        this.scanData = null;
        this.scanError = error?.error?.message || 'No se pudo escanear el documento de identidad. Intenta con una foto más clara.';
      }
    });
  }

  finalize(): void {
    const identityFile = this.identityFile;
    const scanData = this.scanData;

    if (!identityFile || !scanData || !isValidIdentityDocument(scanData) || this.finalizing) return;
    this.finalizing = true;

    this.userService.finalizePublicIdentityVerification(this.token, identityFile, scanData).subscribe({
      next: () => {
        this.finalizing = false;
        this.completed = true;
        this.messageService.add({
          severity: 'success',
          summary: 'Cuenta verificada',
          detail: 'Tu cuenta fue verificada correctamente.',
          life: 3000
        });
      },
      error: (error) => {
        this.finalizing = false;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo verificar',
          detail: getApiErrorMessage(error, 'No se pudo finalizar la verificación de identidad'),
          life: 3600
        });
      }
    });
  }

  getDataEntries(): Array<{ label: string; value: any }> {
    if (!this.scanData) return [];

    const labels: Record<string, string> = {
      nombres: 'Nombres',
      apellidos: 'Apellidos',
      fecha_nacimiento: 'Fecha de nacimiento',
      direccion: 'Dirección',
      municipio: 'Municipio',
      provincia: 'Provincia',
      confidence: 'Confianza'
    };

    const entries = Object.entries(labels)
      .map(([key, label]) => ({ label, value: this.scanData?.[key] }))
      .filter(item => item.value !== undefined && item.value !== null && item.value !== '');

    const number = getIdentityDocumentNumber(this.scanData);
    return number ? [{ label: this.getDocumentLabel(), value: number }, ...entries] : entries;
  }

  getDocumentLabel(): string {
    return getIdentityDocumentLabel(this.scanData);
  }

  isDocumentValid(): boolean {
    return isValidIdentityDocument(this.scanData);
  }

  private hasCompleteIdentityData(data: any): boolean {
    return hasCompleteIdentityData(data);
  }
}
