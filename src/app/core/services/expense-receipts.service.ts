import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ExpenseReceipt {
  _id: string;
  employee_id: string;
  employee_name: string;
  employee_email?: string;
  registered_by_id?: string;
  registered_by_name?: string;
  registered_by_email?: string;
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
  updatedAt?: string;
  edited_at?: string;
  edited_by_name?: string;
}

export interface ExpenseReceiptUpdate {
  employee_id?: string;
  merchant_name?: string;
  tax_id?: string;
  receipt_number?: string;
  ncf?: string;
  expense_date?: string | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  total_amount?: number | null;
  currency?: string;
  category?: string;
  accounting_category?: ExpenseReceiptAccountingCategory;
  description?: string;
  payment_method?: string;
  expected_updated_at?: string;
}

export type ExpenseReceiptAccountingCategory =
  | 'gasto_operativo'
  | 'gasto_representacion';

export interface ExpenseReceiptPage {
  data: ExpenseReceipt[];
  total: number;
  page: number;
  limit: number;
}

export interface ExpenseReceiptEmployee {
  employee_id: string;
  employee_name: string;
  employee_email?: string;
}

export interface ExpenseReceiptFilters {
  employee_id?: string;
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

  upload(
    image: File,
    accountingCategory: ExpenseReceiptAccountingCategory,
    employeeId: string,
  ): Observable<ExpenseReceipt> {
    const formData = new FormData();
    formData.append('image', image, image.name);
    formData.append('accounting_category', accountingCategory);
    formData.append('employee_id', employeeId);
    return this.http.post<ExpenseReceipt>(this.apiUrl, formData);
  }

  getAll(filters: ExpenseReceiptFilters = {}): Observable<ExpenseReceiptPage> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim()) {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<ExpenseReceiptPage>(this.apiUrl, { params });
  }

  getEmployees(): Observable<ExpenseReceiptEmployee[]> {
    return this.http.get<ExpenseReceiptEmployee[]>(`${this.apiUrl}/employees`);
  }

  getEligibleEmployees(): Observable<ExpenseReceiptEmployee[]> {
    return this.http.get<ExpenseReceiptEmployee[]>(`${this.apiUrl}/eligible-employees`);
  }

  reprocess(id: string): Observable<ExpenseReceipt> {
    return this.http.post<ExpenseReceipt>(`${this.apiUrl}/${id}/reprocess`, {});
  }

  update(id: string, changes: ExpenseReceiptUpdate): Observable<ExpenseReceipt> {
    return this.http.patch<ExpenseReceipt>(`${this.apiUrl}/${id}`, changes);
  }

  remove(id: string, expectedUpdatedAt?: string): Observable<{ deleted: boolean; id: string }> {
    const params = expectedUpdatedAt ? new HttpParams().set('expected_updated_at', expectedUpdatedAt) : undefined;
    return this.http.delete<{ deleted: boolean; id: string }>(`${this.apiUrl}/${id}`, { params });
  }
}
