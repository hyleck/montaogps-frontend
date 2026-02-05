import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Form } from '../interfaces/form.interface';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class FormsService {
    private apiUrl = `${environment.apiUrl}/forms`;

    constructor(private http: HttpClient) { }

    getAllForms(): Observable<Form[]> {
        return this.http.get<Form[]>(this.apiUrl);
    }

    getFormById(id: string): Observable<Form> {
        return this.http.get<Form>(`${this.apiUrl}/${id}`);
    }

    createForm(form: Form): Observable<Form> {
        return this.http.post<Form>(this.apiUrl, form);
    }

    updateForm(id: string, form: Form): Observable<Form> {
        return this.http.patch<Form>(`${this.apiUrl}/${id}`, form);
    }

    deleteForm(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }
}
