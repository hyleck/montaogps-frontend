export interface Server {
  _id: string;
  name: string;
  description: string;
  url: string;
  token: string;
  months_of_storage: number;
  device_limit: number;
  maintenance: boolean;
}

export interface CreateServerDto {
  name: string;
  description: string;
  url: string;
  token: string;
  months_of_storage: number;
  device_limit: number;
  maintenance: boolean;
}

export interface UpdateServerDto {
  name?: string;
  description?: string;
  url?: string;
  token?: string;
  months_of_storage?: number;
  device_limit?: number;
  maintenance?: boolean;
} 