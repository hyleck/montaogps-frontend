import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Note {
  _id: string;
  title: string;
  content?: string;
  owner: string;
  private?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNoteDto {
  title: string;
  content?: string;
  owner?: string;
  private?: boolean;
}

export interface UpdateNoteDto {
  title?: string;
  content?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotesService {
  private apiUrl = `${environment.apiUrl}/notes`;

  constructor(private http: HttpClient) {}

  // Create a new note
  createNote(createNoteDto: CreateNoteDto): Observable<any> {
    return this.http.post(`${this.apiUrl}`, createNoteDto);
  }

  // Get all notes for owner
  getNotes(owner?: string): Observable<Note[]> {
    const params: any = {};
    if (owner) {
      params.owner = owner;
    }
    return this.http.get<Note[]>(`${this.apiUrl}`, { params });
  }

  // Get note by ID
  getNoteById(id: string): Observable<Note> {
    return this.http.get<Note>(`${this.apiUrl}/${id}`);
  }

  // Update note
  updateNote(id: string, updateNoteDto: UpdateNoteDto): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, updateNoteDto);
  }

  // Delete note
  deleteNote(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // Search notes
  searchNotes(query: string, owner?: string): Observable<Note[]> {
    const params: any = { q: query };
    if (owner) {
      params.owner = owner;
    }
    return this.http.get<Note[]>(`${this.apiUrl}/search`, { params });
  }
}