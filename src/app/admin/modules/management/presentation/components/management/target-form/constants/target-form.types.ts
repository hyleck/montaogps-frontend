// Tipos específicos para el formulario de target

export interface SelectOption {
  label: string;
  value: string;
}

export interface SmsMessage {
  type: 'sent' | 'received';
  content: string;
  timestamp: Date;
  from?: string;
  to?: string;
  id?: number;
  read?: boolean;
  delivered?: boolean;
  createdby?: string;
  pending?: boolean;
}

export interface CustomPrice {
  id: string;
  amount: number;
  payment_period: string;
  originalAmount?: number;
}

export type MessageType = 'sent' | 'received';
export type DeviceStatus = 'online' | 'offline';
export type TargetStatus = 'active' | 'inactive' | boolean; 
