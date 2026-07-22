import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { UserService, PublicIdentityVerificationInfo } from '../core/services/user.service';
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
      this.scanError = 'Debe subir una imagen clara de la cédula.';
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

        if (this.scanData?.['es_cedula'] !== true) {
          this.scanError = this.scanData?.['mensaje_usuario']
            || 'La imagen subida no parece ser una cédula. Sube una foto clara de tu cédula de identidad.';
          return;
        }

        if (!this.hasCompleteIdentityData(this.scanData)) {
          this.scanError = 'No se pudieron leer claramente los datos de la cédula. Sube una foto donde se vea completo el nombre, apellido y número de cédula.';
          this.scanData = null;
          return;
        }

        this.messageService.add({
          severity: 'success',
          summary: 'Cédula digitalizada',
          detail: 'Estamos verificando tu cuenta automáticamente.',
          life: 3000
        });
        this.finalize();
      },
      error: (error) => {
        this.scanning = false;
        this.scanData = null;
        this.scanError = error?.error?.message || 'No se pudo escanear la cédula. Intenta con una foto más clara.';
      }
    });
  }

  finalize(): void {
    if (!this.identityFile || !this.scanData || this.scanData['es_cedula'] !== true || this.finalizing) return;
    this.finalizing = true;

    this.userService.finalizePublicIdentityVerification(this.token, this.identityFile, this.scanData).subscribe({
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
          detail: error?.error?.message || 'Intenta nuevamente.',
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
      cedula: 'Cédula',
      fecha_nacimiento: 'Fecha de nacimiento',
      direccion: 'Dirección',
      municipio: 'Municipio',
      provincia: 'Provincia',
      confidence: 'Confianza'
    };

    return Object.entries(labels)
      .map(([key, label]) => ({ label, value: this.scanData?.[key] }))
      .filter(item => item.value !== undefined && item.value !== null && item.value !== '');
  }

  private hasCompleteIdentityData(data: any): boolean {
    const nombres = this.cleanText(data?.nombres);
    const apellidos = this.cleanText(data?.apellidos);
    const cedula = this.cleanText(data?.cedula);
    return !!nombres && !!apellidos && cedula.replace(/\D/g, '').length >= 9;
  }

  private cleanText(value: any): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
