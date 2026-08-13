import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type InstructivoPlatform = 'mobile' | 'desktop';

export interface InstructivoGuide {
  id: string;
  title: string;
  platform: InstructivoPlatform;
  category: string;
  steps: string[];
  notes: string[];
}

export interface InstructivosResponse {
  userType: string;
  guides: InstructivoGuide[];
}

@Injectable({ providedIn: 'root' })
export class InstructivosService {
  private readonly url = `${environment.apiUrl}/ester/process-guides`;

  constructor(private readonly http: HttpClient) {}

  getGuides(): Observable<InstructivosResponse> {
    return this.http.get<InstructivosResponse>(this.url);
  }
}
