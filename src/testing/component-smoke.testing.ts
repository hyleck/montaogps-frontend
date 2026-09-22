import { EnvironmentProviders, NO_ERRORS_SCHEMA, Provider, SchemaMetadata } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { DeviceLabelPipe } from 'src/app/shareds/pipes/device-label.pipe';

/**
 * Entorno mínimo para las pruebas «should create»: el componente se crea con sus servicios reales,
 * pero ninguna petición HTTP sale (HttpClientTesting), las traducciones devuelven la clave y los
 * elementos de PrimeNG del template no se compilan (NO_ERRORS_SCHEMA). Los pipes sí se
 * necesitan: se incluyen los compartidos (deviceLabel).
 */
export const SMOKE_IMPORTS = [FormsModule, ReactiveFormsModule, TranslateModule.forRoot(), DeviceLabelPipe];

export const SMOKE_PROVIDERS: (Provider | EnvironmentProviders)[] = [
  provideHttpClient(),
  provideHttpClientTesting(),
  provideRouter([]),
  provideNoopAnimations(),
  ConfirmationService,
  MessageService,
  DialogService,
];

export const SMOKE_SCHEMAS: SchemaMetadata[] = [NO_ERRORS_SCHEMA];
