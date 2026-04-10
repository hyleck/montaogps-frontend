import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProcessStat {
    _id: number;
    count: number;
    lastCreated: string;
    firstCreated: string;
}

export interface ProcessStatsResponse {
    totalProcesses: number;
    processesByType: ProcessStat[];
    generatedAt: string;
}

export interface CreatorStat {
    _id: string; // The creator ID
    totalProcesses: number;
    processesByType: { type: number; count: number }[];
    creatorName: string;
    creatorEmail: string;
}

export interface CreatorStatsResponse {
    statsByCreator: CreatorStat[];
    generatedAt: string;
}

@Injectable({
    providedIn: 'root'
})
export class ProcessService {
    private apiUrl = `${environment.apiUrl}/process`;

    constructor(private http: HttpClient) { }

    getStats(): Observable<ProcessStatsResponse> {
        return this.http.get<ProcessStatsResponse>(`${this.apiUrl}/stats`);
    }

    getStatsByCreator(): Observable<CreatorStatsResponse> {
        return this.http.get<CreatorStatsResponse>(`${this.apiUrl}/stats/creator`);
    }

    getTimelineByCreator(creatorId: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/stats/creator/${creatorId}/timeline`);
    }
}
