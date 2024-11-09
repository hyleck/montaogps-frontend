import { Observable } from 'rxjs';
import { User } from '../entities/user.entity'; 
import { LoginUserData, RegisterUserData } from './auth.interfaces';

export abstract class AuthPort {

  abstract login(loginUserData: LoginUserData): Observable<User>;
  abstract register(registerUserData: RegisterUserData): Observable<User>;

  abstract logout(): Observable<void>;
  abstract refreshToken(): Observable<string>;
  
}
