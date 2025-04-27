import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, CreateUserDto, UpdateUserDto } from '../interfaces';

interface UpdatePasswordDto {
    password: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) { }

  getAll(parent?: string): Observable<User[]> {
    let params = {};
    if (parent) {
      params = { params: { parent } };
    }
    return this.http.get<User[]>(this.apiUrl, params);
  }

  getById(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  create(createUserDto: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.apiUrl, createUserDto);
  }

  update(id: string, updateUserDto: UpdateUserDto): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}`, updateUserDto);
  }

  updatePassword(id: string, updatePasswordDto: UpdatePasswordDto): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}`, updatePasswordDto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}