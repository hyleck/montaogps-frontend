import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { Router } from '@angular/router';
import html2canvas from 'html2canvas';
import { environment } from '../../../environments/environment';
import {
    Ticket,
    CreateTicketDto,
    SupportDiagnosticCapture,
    SupportImageAttachment,
    SupportAssistantRequest,
    SupportAssistantResponse,
    SupportTicketDiagnostics,
} from '../interfaces/support.interface';

@Injectable({
    providedIn: 'root'
})
export class SupportService {
    private apiUrl = `${environment.apiUrl}/support`;
    private readonly floatingAquilesRequestedSubject = new Subject<void>();

    readonly floatingAquilesRequested$ = this.floatingAquilesRequestedSubject.asObservable();

    constructor(
        private http: HttpClient,
        private router: Router,
    ) { }

    openFloatingAquiles(): void {
        this.floatingAquilesRequestedSubject.next();
    }

    getTickets(): Observable<Ticket[]> {
        return this.http.get<Ticket[]>(`${this.apiUrl}/tickets`);
    }

    createTicket(
        ticket: CreateTicketDto,
        diagnosticCapture?: SupportDiagnosticCapture | null,
    ): Observable<Ticket> {
        if (diagnosticCapture) {
            const formData = new FormData();
            formData.append('title', ticket.title);
            formData.append('description', ticket.description);
            formData.append('priority', ticket.priority || 'medium');
            formData.append(
                'diagnostics',
                JSON.stringify(diagnosticCapture.diagnostics),
            );
            if (diagnosticCapture.screenshotFile) {
                formData.append(
                    'screenshot',
                    diagnosticCapture.screenshotFile,
                    diagnosticCapture.screenshotFile.name,
                );
            }
            return this.http.post<Ticket>(`${this.apiUrl}/tickets`, formData);
        }
        return this.http.post<Ticket>(`${this.apiUrl}/tickets`, ticket);
    }

    chatWithAquiles(request: SupportAssistantRequest): Observable<SupportAssistantResponse> {
        return this.http.post<SupportAssistantResponse>(`${this.apiUrl}/assistant`, request);
    }

    async prepareAquilesImage(file: File): Promise<SupportImageAttachment> {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
        if (!allowedTypes.includes(file.type as typeof allowedTypes[number])) {
            throw new Error('Usa una foto JPG, PNG o WebP.');
        }
        if (!file.size || file.size > 12_000_000) {
            throw new Error('La foto debe pesar 12 MB o menos.');
        }

        const sourcePreviewUrl = URL.createObjectURL(file);
        let keepSourcePreview = false;
        try {
            const image = await this.loadAquilesImage(sourcePreviewUrl);
            const originalDataUrl = await this.blobToDataUrl(file);
            if (originalDataUrl.length <= 2_850_000) {
                keepSourcePreview = true;
                return {
                    name: this.normalizeAquilesImageName(file.name),
                    mimeType: file.type as SupportImageAttachment['mimeType'],
                    dataUrl: originalDataUrl,
                    previewUrl: sourcePreviewUrl,
                    file,
                };
            }

            for (const attempt of [
                { maxDimension: 1600, quality: 0.8 },
                { maxDimension: 1300, quality: 0.7 },
                { maxDimension: 1000, quality: 0.62 },
            ]) {
                const scale = Math.min(
                    1,
                    attempt.maxDimension / Math.max(image.naturalWidth, image.naturalHeight, 1),
                );
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
                const context = canvas.getContext('2d');
                if (!context) throw new Error('No se pudo preparar la foto.');
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                const compressedBlob = await this.canvasToBlob(
                    canvas,
                    'image/jpeg',
                    attempt.quality,
                );
                const dataUrl = await this.blobToDataUrl(compressedBlob);
                if (dataUrl.length > 2_850_000) continue;
                const compressedFile = new File(
                    [compressedBlob],
                    this.normalizeAquilesImageName(file.name).replace(/\.[^.]+$/, '') + '.jpg',
                    { type: 'image/jpeg' },
                );
                return {
                    name: compressedFile.name,
                    mimeType: 'image/jpeg',
                    dataUrl,
                    previewUrl: URL.createObjectURL(compressedBlob),
                    file: compressedFile,
                };
            }
            throw new Error('No pude reducir la foto al tamaño permitido.');
        } finally {
            if (!keepSourcePreview) URL.revokeObjectURL(sourcePreviewUrl);
        }
    }

    async captureAquilesDiagnostics(): Promise<SupportDiagnosticCapture> {
        const diagnostics: SupportTicketDiagnostics = {
            route: this.router.url || window.location.pathname || '/',
            browser: String(navigator.userAgent || '').slice(0, 300),
            captured_at: new Date().toISOString(),
            viewport: `${window.innerWidth}x${window.innerHeight} @${Math.min(window.devicePixelRatio || 1, 4)}x`,
        };
        const summary = this.buildAquilesDiagnosticSummary(diagnostics);

        try {
            const viewportScale = Math.min(
                1,
                1280 / Math.max(window.innerWidth, 1),
                900 / Math.max(window.innerHeight, 1),
            );
            const canvas = await html2canvas(document.body, {
                scale: Math.max(0.45, viewportScale),
                width: window.innerWidth,
                height: window.innerHeight,
                x: window.scrollX,
                y: window.scrollY,
                scrollX: -window.scrollX,
                scrollY: -window.scrollY,
                useCORS: true,
                allowTaint: false,
                logging: false,
                backgroundColor: getComputedStyle(document.body).backgroundColor || '#111827',
                onclone: clonedDocument => this.prepareSupportScreenshotClone(clonedDocument),
            });
            const screenshotBlob = await this.canvasToBlob(canvas);
            const screenshotDataUrl = await this.blobToDataUrl(screenshotBlob);
            if (screenshotDataUrl.length > 3_000_000) {
                throw new Error('La captura supera el tamaño permitido.');
            }
            return {
                diagnostics,
                summary,
                screenshotDataUrl,
                screenshotFile: new File(
                    [screenshotBlob],
                    `captura-aquiles-${Date.now()}.jpg`,
                    { type: 'image/jpeg' },
                ),
            };
        } catch (error) {
            console.warn('[SUPPORT] No se pudo capturar la pantalla para Aquiles:', error);
            return { diagnostics, summary };
        }
    }

    updateTicket(id: string, ticket: Partial<Ticket>): Observable<Ticket> {
        return this.http.patch<Ticket>(`${this.apiUrl}/tickets/${id}`, ticket);
    }

    deleteTicket(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/tickets/${id}`);
    }

    private buildAquilesDiagnosticSummary(
        diagnostics: SupportTicketDiagnostics,
    ): string {
        const lines = [
            'CONTEXTO DE PANTALLA CAPTURADO AUTOMÁTICAMENTE',
            `- Pantalla: ${diagnostics.route}`,
            `- Capturado: ${diagnostics.captured_at}`,
            `- Vista: ${diagnostics.viewport}`,
        ];
        return lines.join('\n').slice(0, 20_000);
    }

    private prepareSupportScreenshotClone(clonedDocument: Document): void {
        clonedDocument.querySelectorAll('.aquiles-floating-chat').forEach(element => element.remove());
        clonedDocument.querySelectorAll('.support-ticket-dialog').forEach(element => {
            const mask = element.closest('.p-dialog-mask');
            (mask || element).remove();
        });
        clonedDocument.querySelectorAll<HTMLInputElement>('input').forEach(input => {
            const sensitive = input.type === 'password'
                || /(password|pass|token|secret|api[_-]?key)/i.test(
                    `${input.name} ${input.id} ${input.autocomplete}`,
                );
            if (!sensitive) return;
            input.value = '••••••••';
            input.setAttribute('value', '••••••••');
        });
        clonedDocument.querySelectorAll<HTMLElement>('[data-support-sensitive="true"]')
            .forEach(element => {
                element.textContent = '[INFORMACIÓN OCULTA]';
            });
    }

    private canvasToBlob(
        canvas: HTMLCanvasElement,
        type = 'image/jpeg',
        quality = 0.62,
    ): Promise<Blob> {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                blob => blob ? resolve(blob) : reject(new Error('No se pudo generar la captura.')),
                type,
                quality,
            );
        });
    }

    private loadAquilesImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('El archivo no contiene una foto válida.'));
            image.src = url;
        });
    }

    private normalizeAquilesImageName(value: string): string {
        return String(value || 'foto-aquiles.jpg')
            .replace(/[\\/\u0000-\u001f\u007f]+/g, '-')
            .trim()
            .slice(0, 120) || 'foto-aquiles.jpg';
    }

    private blobToDataUrl(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('No se pudo leer la captura.'));
            reader.readAsDataURL(blob);
        });
    }
}
