import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Membresia } from '../interfaces/membresia.interface';

@Injectable({
    providedIn: 'root'
})
export class MembresiasService {
    private apiUrl = `${environment.apiUrl}/membresias`;

    constructor(private http: HttpClient) { }

    getAll(): Observable<Membresia[]> {
        return this.http.get<Membresia[]>(this.apiUrl);
    }

    getById(id: string): Observable<Membresia> {
        return this.http.get<Membresia>(`${this.apiUrl}/${id}`);
    }

    create(membresia: Partial<Membresia>): Observable<Membresia> {
        return this.http.post<Membresia>(this.apiUrl, membresia);
    }

    update(id: string, membresia: Partial<Membresia>): Observable<Membresia> {
        return this.http.patch<Membresia>(`${this.apiUrl}/${id}`, membresia);
    }

    delete(id: string): Observable<Membresia> {
        return this.http.delete<Membresia>(`${this.apiUrl}/${id}`);
    }
}
