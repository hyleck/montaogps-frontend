import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Contact {
  _id?: string;
  full_name: string;
  phone: string;
  dni?: string;
  relationship: string;
  observation?: string;
  reference: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateContactDto {
  full_name: string;
  phone: string;
  dni?: string;
  relationship: string;
  observation?: string;
  reference: string;
}

export interface UpdateContactDto extends Partial<CreateContactDto> { }

@Injectable({
  providedIn: 'root'
})
export class ContactsService {
  private apiUrl = `${environment.apiUrl}/contacts`;

  constructor(private http: HttpClient) { }

  getAll(reference?: string, limit?: number): Observable<Contact[]> {
    const params: any = {};
    if (reference) params.reference = reference;
    if (limit) params.limit = limit;
    return this.http.get<Contact[]>(this.apiUrl, { params });
  }

  create(data: CreateContactDto): Observable<Contact> {
    return this.http.post<Contact>(this.apiUrl, data);
  }

  update(id: string, data: UpdateContactDto): Observable<Contact> {
    return this.http.put<Contact>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
