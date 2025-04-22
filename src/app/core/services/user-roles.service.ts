import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserRole, CreateUserRoleDto, UpdateUserRoleDto } from '../interfaces/user-role.interface';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class UserRolesService {
    private readonly apiUrl = `${environment.apiUrl}/user-roles`;

    constructor(private http: HttpClient) {}

    getAllRoles(): Observable<UserRole[]> {
        return this.http.get<UserRole[]>(this.apiUrl);
    }

    getRoleById(id: string): Observable<UserRole> {
        return this.http.get<UserRole>(`${this.apiUrl}/${id}`);
    }

    createRole(role: CreateUserRoleDto): Observable<UserRole> {
        return this.http.post<UserRole>(this.apiUrl, role);
    }

    updateRole(id: string, role: UpdateUserRoleDto): Observable<UserRole> {
        return this.http.patch<UserRole>(`${this.apiUrl}/${id}`, role);
    }

    deleteRole(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }
} 