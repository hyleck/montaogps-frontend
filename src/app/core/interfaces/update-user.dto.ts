export interface UpdateUserDto {
  email?: string;
  name?: string;
  last_name?: string;
  password?: string;
  isActive?: boolean;
  tag?: string;
  department_id?: string;
  idchatwoot?: string;
  inbox?: number | null;
  inbox2?: number | null;
}