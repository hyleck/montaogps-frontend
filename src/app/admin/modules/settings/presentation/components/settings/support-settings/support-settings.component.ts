import { Component, OnInit } from '@angular/core';
import { SupportService } from '@core/services/support.service';
import { Ticket, CreateTicketDto } from '@core/interfaces/support.interface';
import { MessageService } from 'primeng/api';
import { AuthService } from '@core/services/auth.service';
import { getApiErrorMessage } from '../../../../../../../core/utils/api-error.util';

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
    currentUser: any = null;
    ticketSearch: string = '';
    ticketStatusFilter: 'all' | Ticket['status'] = 'all';

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

    statusOptions = [
        { label: 'Abierto', value: 'open' },
        { label: 'En Progreso', value: 'in_progress' },
        { label: 'Resuelto', value: 'resolved' },
        { label: 'Cerrado', value: 'closed' }
    ];

    constructor(
        private supportService: SupportService,
        private messageService: MessageService,
        private authService: AuthService
    ) {
        this.currentUser = this.authService.getCurrentUser();
    }

    ngOnInit(): void {
        this.loadTickets();
    }

    get filteredTickets(): Ticket[] {
        const search = this.ticketSearch.trim().toLowerCase();
        return this.tickets.filter((ticket) => {
            const matchesStatus = this.ticketStatusFilter === 'all'
                || ticket.status === this.ticketStatusFilter;
            const searchable = [
                ticket._id,
                ticket.title,
                ticket.description,
                ticket.user?.name,
                ticket.user?.last_name,
                ticket.user?.email
            ].filter(Boolean).join(' ').toLowerCase();
            return matchesStatus && (!search || searchable.includes(search));
        });
    }

    get activeTicketsCount(): number {
        return this.tickets.filter(ticket =>
            ticket.status === 'open' || ticket.status === 'in_progress'
        ).length;
    }

    get inProgressTicketsCount(): number {
        return this.tickets.filter(ticket => ticket.status === 'in_progress').length;
    }

    get completedTicketsCount(): number {
        return this.tickets.filter(ticket =>
            ticket.status === 'resolved' || ticket.status === 'closed'
        ).length;
    }

    get resolutionRate(): number {
        if (!this.tickets.length) return 0;
        return Math.round((this.completedTicketsCount / this.tickets.length) * 100);
    }

    loadTickets(): void {
        this.loading = true;
        this.supportService.getTickets().subscribe({
            next: (data: Ticket[]) => {
                this.tickets = data;
                this.loading = false;
            },
            error: (error) => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'No se pudieron cargar los tickets') });
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
            error: (error) => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'No se pudo crear el ticket') });
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

    getStatusLabel(status: Ticket['status']): string {
        return this.statusOptions.find(option => option.value === status)?.label || status;
    }

    getPriorityLabel(priority: Ticket['priority']): string {
        return this.priorities.find(option => option.value === priority)?.label || priority;
    }

    getTicketProgress(status: Ticket['status']): number {
        switch (status) {
            case 'open': return 20;
            case 'in_progress': return 60;
            case 'resolved':
            case 'closed': return 100;
            default: return 0;
        }
    }

    getTicketStatusIcon(status: Ticket['status']): string {
        switch (status) {
            case 'open': return 'pi pi-inbox';
            case 'in_progress': return 'pi pi-spin pi-spinner';
            case 'resolved': return 'pi pi-check-circle';
            case 'closed': return 'pi pi-lock';
            default: return 'pi pi-circle';
        }
    }

    getUserInitials(ticket: Ticket): string {
        const name = `${ticket.user?.name || ''} ${ticket.user?.last_name || ''}`.trim();
        if (!name) return 'US';
        return name.split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase();
    }

    trackTicketById(_index: number, ticket: Ticket): string {
        return ticket._id || `${ticket.title}-${ticket.createdAt || ''}`;
    }

    onStatusChange(ticket: Ticket): void {
        if (!ticket || !ticket._id) return;

        console.log(`[SUPPORT] Frontend: Changing ticket ${ticket._id} status to: ${ticket.status}`);

        this.supportService.updateTicket(ticket._id, { status: ticket.status }).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Estado del ticket actualizado correctamente' });
                this.loadTickets();
            },
            error: (error) => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'No se pudo actualizar el estado del ticket') });
            }
        });
    }
}
