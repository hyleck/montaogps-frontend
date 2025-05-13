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
  commands: ProtocolCommand[];
}

export interface CreateProtocolDto {
  name: string;
  description: string;
  port: number;
  img: string;
  commands: ProtocolCommand[];
}

export interface UpdateProtocolDto {
  name?: string;
  description?: string;
  port?: number;
  img?: string;
  commands?: ProtocolCommand[];
} 