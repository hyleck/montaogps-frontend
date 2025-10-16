export interface Server {
  _id: string;
  name: string;
  description: string;
  url: string;
  ip: string;
  token: string;
  months_of_storage: number;
  device_limit: number;
  maintenance: boolean;
}

export interface CreateServerDto {
  name: string;
  description: string;
  url: string;
  ip: string;
  token: string;
  months_of_storage: number;
  device_limit: number;
  maintenance: boolean;
}

export interface UpdateServerDto {
  name?: string;
  description?: string;
  url?: string;
  ip?: string;
  token?: string;
  months_of_storage?: number;
  device_limit?: number;
  maintenance?: boolean;
}

export interface DigitalOceanBalance {
  month_to_date_balance: string;
  account_balance: string;
  month_to_date_usage: string;
  generated_at: string;
}

export interface DigitalOceanBillingHistoryEntry {
  description: string;
  amount: string;
  invoice_id?: string;
  invoice_uuid?: string;
  type: string;
  date: string;
  account?: string;
}

export interface DigitalOceanBillingHistory {
  billing_history?: DigitalOceanBillingHistoryEntry[];
}

export interface DigitalOceanAccountBilling {
  account: string;
  balance?: DigitalOceanBalance;
  billingHistory?: DigitalOceanBillingHistory;
}

export interface DigitalOceanBillingData {
  account?: string;
  balance?: DigitalOceanBalance;
  billingHistory?: DigitalOceanBillingHistory;
  accounts?: DigitalOceanAccountBilling[];
}
