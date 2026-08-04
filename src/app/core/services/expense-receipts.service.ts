import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ExpenseReceipt {
  _id: string;
  employee_id: string;
  employee_name: string;
  employee_email?: string;
  image_url: string;
  image_name?: string;
  merchant_name?: string;
  tax_id?: string;
  receipt_number?: string;
  ncf?: string;
  expense_date?: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  currency?: string;
  category: string;
  accounting_category?: 'gasto_operativo' | 'gasto_representacion';
  description?: string;
  payment_method?: string;
  ai_confidence?: number;
  raw_text?: string;
  processing_status: 'pending' | 'completed' | 'needs_review' | 'failed';
  processing_error?: string;
  digitized_at?: string;
  createdAt?: string;
}

export interface ExpenseReceiptPage {
  data: ExpenseReceipt[];
  total: number;
  page: number;
  limit: number;
}

export interface ExpenseReceiptFilters {
  category?: string;
  accounting_category?: string;
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class ExpenseReceiptsService {
  private readonly apiUrl = `${environment.apiUrl}/expense-receipts`;

  constructor(private readonly http: HttpClient) {}

  getAll(filters: ExpenseReceiptFilters = {}): Observable<ExpenseReceiptPage> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim()) {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<ExpenseReceiptPage>(this.apiUrl, { params });
  }

  reprocess(id: string): Observable<ExpenseReceipt> {
    return this.http.post<ExpenseReceipt>(`${this.apiUrl}/${id}/reprocess`, {});
  }
}
