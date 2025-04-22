export interface TokenPayload {
  user: string;
  exp: number;
  [key: string]: any;
} 