import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ForumCategory {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  order: number;
  topicCount?: number;
  postCount?: number;
}

export interface ForumTopic {
  _id: string;
  categoryId: string;
  authorId: string;
  title: string;
  content: string;
  views: number;
  likes: string[];
  isPinned: boolean;
  isClosed: boolean;
  postCount: number;
  createdAt: string;
  author?: any;
  lastPostAuthor?: any;
  lastPostAt?: string;
}

export interface ForumPost {
  _id: string;
  topicId: string;
  authorId: string;
  content: string;
  likes: string[];
  createdAt: string;
  author?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ForumService {
  private apiUrl = `${environment.apiUrl}/forum`;

  constructor(private http: HttpClient) {}

  // Categories
  getCategories(): Observable<ForumCategory[]> {
    return this.http.get<ForumCategory[]>(`${this.apiUrl}/categories`);
  }

  createCategory(payload: any): Observable<ForumCategory> {
    return this.http.post<ForumCategory>(`${this.apiUrl}/categories`, payload);
  }

  // Topics
  getTopicsByCategory(categoryId: string): Observable<ForumTopic[]> {
    return this.http.get<ForumTopic[]>(`${this.apiUrl}/topics/category/${categoryId}`);
  }

  getTopicDetail(topicId: string): Observable<ForumTopic> {
    return this.http.get<ForumTopic>(`${this.apiUrl}/topics/${topicId}`);
  }

  createTopic(payload: any): Observable<ForumTopic> {
    return this.http.post<ForumTopic>(`${this.apiUrl}/topics`, payload);
  }

  toggleTopicLike(topicId: string): Observable<ForumTopic> {
    return this.http.put<ForumTopic>(`${this.apiUrl}/topics/${topicId}/like`, {});
  }

  // Posts
  getPostsByTopic(topicId: string): Observable<ForumPost[]> {
    return this.http.get<ForumPost[]>(`${this.apiUrl}/posts/topic/${topicId}`);
  }

  createPost(payload: any): Observable<ForumPost> {
    return this.http.post<ForumPost>(`${this.apiUrl}/posts`, payload);
  }

  togglePostLike(postId: string): Observable<ForumPost> {
    return this.http.put<ForumPost>(`${this.apiUrl}/posts/${postId}/like`, {});
  }

  // Deletes
  deleteCategory(categoryId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/categories/${categoryId}`);
  }

  deleteTopic(topicId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/topics/${topicId}`);
  }

  deletePost(postId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/posts/${postId}`);
  }
}
