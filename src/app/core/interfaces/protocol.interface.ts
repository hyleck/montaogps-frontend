export interface ProtocolCommand {
  name: string;
  value: string;
  icon: string;
}

export interface Protocol {
  _id: string;
  name: string;
  description: string;
  port: number;
  img: string;
  utcOffset?: number; // Diferencia UTC en horas (ej: -6, -5, +1)
  queryTimeOffsetMinutes?: number;
  fixTimeOffsetMinutes?: number;
  timestampStrategy?: 'auto' | 'fix_then_server' | 'server';
  isAirtag?: boolean;
  commands: ProtocolCommand[];
}

export interface CreateProtocolDto {
  name: string;
  description: string;
  port: number;
  img: string;
  utcOffset?: number; // Diferencia UTC en horas (ej: -6, -5, +1)
  queryTimeOffsetMinutes?: number;
  fixTimeOffsetMinutes?: number;
  timestampStrategy?: 'auto' | 'fix_then_server' | 'server';
  isAirtag?: boolean;
  commands: ProtocolCommand[];
}

export interface UpdateProtocolDto {
  name?: string;
  description?: string;
  port?: number;
  img?: string;
  utcOffset?: number; // Diferencia UTC en horas (ej: -6, -5, +1)
  queryTimeOffsetMinutes?: number;
  fixTimeOffsetMinutes?: number;
  timestampStrategy?: 'auto' | 'fix_then_server' | 'server';
  isAirtag?: boolean;
  commands?: ProtocolCommand[];
}
