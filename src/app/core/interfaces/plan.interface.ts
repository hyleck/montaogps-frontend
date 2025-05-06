export interface Plan {
  _id: string;
  plan_name: string;
  plan_description: string;
  server_id: string;
  prices: PlanPrice[];
  plan_features: PlanFeature[];
  recommended: boolean;
}

export interface PlanPrice {
  id: string;
  amount: number;
  payment_period: string | number; // Puede ser string ('monthly') o number (30) según el contexto
}

// Interfaz para comunicación interna en la UI
export interface UIPlanPrice {
  id: string;
  amount: number;
  payment_period: string; // monthly, yearly, etc.
}

// Interfaz para comunicación con el backend
export interface ApiPlanPrice {
  id: string;
  amount: number;
  payment_period: number; // 30, 90, 365, etc.
}

export interface PlanFeature {
  id: string;
  name: string;
  description: string;
}

export interface CreatePlanDto {
  plan_name: string;
  plan_description: string;
  server_id: string;
  prices: PlanPrice[];
  plan_features: PlanFeature[];
  recommended: boolean;
}

export interface UpdatePlanDto {
  plan_name?: string;
  plan_description?: string;
  server_id?: string;
  prices?: PlanPrice[];
  plan_features?: PlanFeature[];
  recommended?: boolean;
} 