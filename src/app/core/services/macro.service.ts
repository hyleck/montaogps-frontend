import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DeviceDto {
  _id: string;
  name: string;
  device_imei: string;
  api_device_id?: string;
  api_position_id?: string;
  description?: string;
  type?: string;
  sim_card_number?: string;
  sim_company?: string;
  installation_details?: string;
  target_plate_number?: string;
  contacts?: any[];
  mechanic_id?: string;
  target_brand_id?: string;
  target_model_id?: string;
  target_color?: string;
  target_year?: string;
  installation_location?: string;
  engine_shutdown?: boolean;
  ignition_sensor?: boolean;
  required_check?: boolean;
  creator_id?: string;
  activation_date?: string;
  expiration_date?: string;
  last_change_date?: string;
  status?: boolean;
  canceled?: boolean;
  deleted?: boolean;
  activated?: boolean;
  target_chassis_number?: string;
  shared?: string[];
  index?: string;
  parent_id?: string;
  protocol?: {
    _id: string;
    name: string;
  };
  plan?: {
    id_plan: string;
    name?: string;
    server_ip?: string;
    selected_price: {
      payment_period: string;
      amount: number;
      id: string;
    };
  };
  installation_description?: string;
  traccarInfo?: any;
}

@Injectable({
  providedIn: 'root'
})
export class MacroService {

  private apiUrl = `${environment.apiUrl}/macro`;

  constructor(private http: HttpClient) { }

  getDevices(plan?: string, limit?: number, commandIndex?: number): Observable<DeviceDto[]> {
    const params: any = {};
    if (plan && plan.trim() !== '') {
      params.plan = plan;
    }
    if (limit && limit > 0) {
      params.limit = limit.toString();
    }
    if (commandIndex !== undefined && commandIndex >= 0) {
      params.commandIndex = commandIndex.toString();
    }
    return this.http.get<DeviceDto[]>(`${this.apiUrl}/devices`, { params });
  }
}