import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { PrimengModule } from '../shareds/libraries/primeng/primeng.module';
import { PublicVehicleVerificationInfo, TargetsService } from '../core/services/targets.service';

@Component({
  selector: 'app-public-vehicle-verification',
  templateUrl: './public-vehicle-verification.component.html',
  styleUrls: ['./public-vehicle-verification.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PrimengModule
  ]
})
export class PublicVehicleVerificationComponent implements OnInit, OnDestroy {
  token = '';
  loading = true;
  scanning = false;
  finalizing = false;
  completed = false;
  info: PublicVehicleVerificationInfo | null = null;
  errorMessage = '';
  scanError = '';
  voiceMessage = '';
  voiceAudioUrl = '';
  registrationFile: File | null = null;
  previewUrl = '';
  scanData: Record<string, any> | null = null;

  constructor(
    private route: ActivatedRoute,
    private targetsService: TargetsService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    this.loadInfo();
  }

  ngOnDestroy(): void {
    this.revokePreview();
    this.revokeVoice();
  }

  loadInfo(): void {
    this.loading = true;
    this.errorMessage = '';
    this.targetsService.getPublicVehicleVerificationInfo(this.token)
      .then((info) => {
        this.info = info;
        this.loading = false;
        this.completed = info.device.verificado === true;
      })
      .catch((error) => {
        this.errorMessage = error?.error?.message || 'Este link de verificación no es válido o ya expiró.';
        this.loading = false;
      });
  }

  onRegistrationFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = '';
    this.scanError = '';
    this.voiceMessage = '';
    this.scanData = null;
    this.registrationFile = file;
    this.revokePreview();
    this.revokeVoice();

    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.scanError = 'Debe subir una imagen clara de la matrícula.';
      return;
    }

    this.previewUrl = URL.createObjectURL(file);
    void this.scanRegistration(file);
  }

  async scanRegistration(file: File): Promise<void> {
    if (this.scanning) return;
    this.scanning = true;
    this.scanError = '';

    try {
      const response = await this.targetsService.scanPublicVehicleRegistration(this.token, file);
      this.scanData = response?.data || null;

      if (this.scanData?.['es_matricula'] !== true) {
        this.voiceMessage = this.scanData?.['mensaje_usuario']
          || 'La imagen subida no parece ser una matrícula. Sube una foto clara del documento oficial del vehículo.';
        if (response?.voiceAudio?.base64) {
          this.voiceAudioUrl = this.createVoiceUrl(response.voiceAudio);
          this.playVoice();
        }
        return;
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Matrícula digitalizada',
        detail: 'Estamos verificando el vehículo automáticamente.',
        life: 3000
      });
      this.scanning = false;
      await this.finalize();
    } catch (error: any) {
      this.scanData = null;
      this.scanError = error?.error?.message || 'No se pudo escanear la matrícula. Intenta con una foto más clara.';
    } finally {
      this.scanning = false;
    }
  }

  async finalize(): Promise<void> {
    if (!this.registrationFile || !this.scanData || this.scanData['es_matricula'] !== true || this.finalizing) return;
    this.finalizing = true;

    try {
      await this.targetsService.finalizePublicVehicleRegistration(this.token, this.registrationFile, this.scanData);
      this.completed = true;
      this.messageService.add({
        severity: 'success',
        summary: 'Vehículo verificado',
        detail: 'Los datos de la matrícula fueron guardados correctamente.',
        life: 3000
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo verificar',
        detail: error?.error?.message || 'Intenta nuevamente.',
        life: 3600
      });
    } finally {
      this.finalizing = false;
    }
  }

  getDataEntries(): Array<{ label: string; value: any }> {
    if (!this.scanData) return [];

    const labels: Record<string, string> = {
      descripcion_imagen: 'Lo que subiste',
      placa: 'Placa',
      chasis: 'Chasis',
      marca: 'Marca',
      modelo: 'Modelo',
      ano: 'Año',
      color: 'Color',
      tipo: 'Tipo',
      propietario: 'Propietario',
      cedula_rnc: 'Cédula/RNC',
      registro: 'Registro',
      fecha_emision: 'Fecha emisión',
      fecha_expiracion: 'Fecha expiración',
      confidence: 'Confianza'
    };

    return Object.entries(this.scanData)
      .filter(([key, value]) => !['otros_datos', 'es_matricula', 'mensaje_usuario'].includes(key)
        && value !== undefined && value !== null && value !== '')
      .map(([key, value]) => ({
        label: labels[key] || key,
        value: typeof value === 'number' && key === 'confidence' ? `${Math.round(value * 100)}%` : String(value)
      }));
  }

  playVoice(): void {
    if (!this.voiceAudioUrl) return;
    new Audio(this.voiceAudioUrl).play().catch(() => undefined);
  }

  private createVoiceUrl(audio: { mimeType: string; base64: string }): string {
    const binary = atob(audio.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }
    return URL.createObjectURL(new Blob([bytes], { type: audio.mimeType || 'audio/mpeg' }));
  }

  private revokePreview(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = '';
    }
  }

  private revokeVoice(): void {
    if (this.voiceAudioUrl) {
      URL.revokeObjectURL(this.voiceAudioUrl);
      this.voiceAudioUrl = '';
    }
  }
}
