import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Tag } from '../interfaces/tag.interface';

@Injectable({
    providedIn: 'root'
})
export class TagsService {
    private apiUrl = `${environment.apiUrl}/tags`;

    constructor(private http: HttpClient) { }

    getAllTags(): Observable<Tag[]> {
        return this.http.get<Tag[]>(this.apiUrl);
    }

    getTagById(id: string): Observable<Tag> {
        return this.http.get<Tag>(`${this.apiUrl}/${id}`);
    }

    createTag(tag: Tag): Observable<Tag> {
        return this.http.post<Tag>(this.apiUrl, tag);
    }

    updateTag(id: string, tag: Tag): Observable<Tag> {
        return this.http.patch<Tag>(`${this.apiUrl}/${id}`, tag);
    }

    deleteTag(id: string): Observable<Tag> {
        return this.http.delete<Tag>(`${this.apiUrl}/${id}`);
    }
}
