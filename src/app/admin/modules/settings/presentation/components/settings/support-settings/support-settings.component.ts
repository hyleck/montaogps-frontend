import { Component, OnInit } from '@angular/core';
import { SupportService } from '@core/services/support.service';
import { Ticket, CreateTicketDto } from '@core/interfaces/support.interface';
import { MessageService } from 'primeng/api';

@Component({
    selector: 'app-support-settings',
    templateUrl: './support-settings.component.html',
    styleUrls: ['./support-settings.component.css'],
    standalone: false
})
export class SupportSettingsComponent implements OnInit {
    tickets: Ticket[] = [];
    loading: boolean = false;
    displayDialog: boolean = false;
    viewDialog: boolean = false;
    selectedTicket: Ticket | null = null;

    newTicket: CreateTicketDto = {
        title: '',
        description: '',
        priority: 'low'
    };

    priorities = [
        { label: 'Baja', value: 'low' },
        { label: 'Media', value: 'medium' },
        { label: 'Alta', value: 'high' },
        { label: 'Crítica', value: 'critical' }
    ];

    constructor(
        private supportService: SupportService,
        private messageService: MessageService
    ) { }

    ngOnInit(): void {
        this.loadTickets();
    }

    loadTickets(): void {
        this.loading = true;
        this.supportService.getTickets().subscribe({
            next: (data: Ticket[]) => {
                this.tickets = data;
                this.loading = false;
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los tickets' });
                this.loading = false;
            }
        });
    }

    openNewTicketDialog(): void {
        this.newTicket = {
            title: '',
            description: '',
            priority: 'low'
        };
        this.displayDialog = true;
    }

    viewTicket(ticket: Ticket): void {
        this.selectedTicket = ticket;
        this.viewDialog = true;
    }

    saveTicket(): void {
        if (!this.newTicket.title || !this.newTicket.description) {
            this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Por favor complete todos los campos' });
            return;
        }

        this.supportService.createTicket(this.newTicket).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Ticket creado correctamente' });
                this.displayDialog = false;
                this.loadTickets();
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear el ticket' });
            }
        });
    }

    getStatusSeverity(status: string): string {
        switch (status) {
            case 'open': return 'info';
            case 'in_progress': return 'warn';
            case 'resolved': return 'success';
            case 'closed': return 'secondary';
            default: return 'info';
        }
    }

    getPrioritySeverity(priority: string): string {

        switch (priority) {
            case 'low': return 'success';
            case 'medium': return 'info';
            case 'high': return 'warn';
            case 'critical': return 'danger';
            default: return 'info';
        }
    }
}
