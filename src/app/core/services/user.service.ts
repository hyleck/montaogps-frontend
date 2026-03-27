import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, CreateUserDto, UpdateUserDto } from '../interfaces';

interface UpdatePasswordDto {
  password: string;
}

export interface UsersResponse {
  users: User[];
  totalCount: number;
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

  getAllWithPagination(parent: string, offset: number = 0, limit: number = 30): Observable<UsersResponse> {
    const params = {
      parent,
      offset: offset.toString(),
      limit: limit.toString()
    };
    return this.http.get<UsersResponse>(this.apiUrl, { params });
  }

  search(query: string, parent?: string, offset: number = 0, limit: number = 30): Observable<UsersResponse> {
    let params: any = {
      q: query,
      offset: offset.toString(),
      limit: limit.toString()
    };
    if (parent) {
      params.parent = parent;
    }
    return this.http.get<UsersResponse>(`${this.apiUrl}/search`, { params });
  }

  getByEmail(email: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/by-email?email=${encodeURIComponent(email)}`);
  }

  getByPhone(phone: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/by-phone`, { params: { phone } });
  }

  getById(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  getUserPath(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}/path/`);
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

  closeSessions(id: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/close-sessions`, {});
  }

  deleteSession(id: string, sessionDateStr: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}/sessions/${sessionDateStr}`);
  }

  getTechnicians(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/technicians`);
  }

  getSharedUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/shared`);
  }

  getEmployees(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/employees`);
  }
}