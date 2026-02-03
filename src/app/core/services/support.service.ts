import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Ticket, CreateTicketDto } from '../interfaces/support.interface';

@Injectable({
    providedIn: 'root'
})
export class SupportService {
    private apiUrl = `${environment.apiUrl}/support`;

    constructor(private http: HttpClient) { }

    getTickets(): Observable<Ticket[]> {
        return this.http.get<Ticket[]>(`${this.apiUrl}/tickets`);
    }

    createTicket(ticket: CreateTicketDto): Observable<Ticket> {
        return this.http.post<Ticket>(`${this.apiUrl}/tickets`, ticket);
    }

    updateTicket(id: string, ticket: Partial<Ticket>): Observable<Ticket> {
        return this.http.patch<Ticket>(`${this.apiUrl}/tickets/${id}`, ticket);
    }

    deleteTicket(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/tickets/${id}`);
    }
}
