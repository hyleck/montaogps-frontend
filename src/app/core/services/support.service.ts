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
    SupportAssistantRequest,
    SupportAssistantResponse,
    SupportTicketDiagnostics,
} from '../interfaces/support.interface';
import { UserConsoleLogService } from './user-console-log.service';

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
        private userConsoleLogs: UserConsoleLogService,
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

    async captureAquilesDiagnostics(): Promise<SupportDiagnosticCapture> {
        const diagnostics: SupportTicketDiagnostics = {
            route: this.router.url || window.location.pathname || '/',
            browser: String(navigator.userAgent || '').slice(0, 300),
            captured_at: new Date().toISOString(),
            viewport: `${window.innerWidth}x${window.innerHeight} @${Math.min(window.devicePixelRatio || 1, 4)}x`,
            console_entries: this.userConsoleLogs.getRecentDiagnostics(30),
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
            'DIAGNÓSTICO DEL NAVEGADOR CAPTURADO AUTOMÁTICAMENTE',
            `- Pantalla: ${diagnostics.route}`,
            `- Capturado: ${diagnostics.captured_at}`,
            `- Vista: ${diagnostics.viewport}`,
            `- Errores o advertencias recientes: ${diagnostics.console_entries.length}`,
        ];
        diagnostics.console_entries.slice(-20).forEach(entry => {
            lines.push(
                `- [${entry.level.toUpperCase()}] ${entry.occurred_at} ${entry.route}: ${entry.message.slice(0, 900)}`,
            );
        });
        if (!diagnostics.console_entries.length) {
            lines.push('- No se registraron errores ni advertencias recientes en esta sesión.');
        }
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

    private canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                blob => blob ? resolve(blob) : reject(new Error('No se pudo generar la captura.')),
                'image/jpeg',
                0.62,
            );
        });
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
