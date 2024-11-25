import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class StatusService {
  private statusKey = 'appStatus'; // Clave para el localStorage
  private status: any = {}; // Estado en memoria
  private statusChangeSubject = new BehaviorSubject<any>(null); // Subject para emitir cambios

  statusChanges$ = this.statusChangeSubject.asObservable(); // Observable para que otros se suscriban

  constructor() {
    this.loadFromLocalStorage();
  }

  // Guardar un estado
  setState(key: string, value: any): void {
    this.status[key] = value;
    this.saveToLocalStorage();
    this.emitStatusChange(); // Emitir cambios
  }

  // Obtener un estado
  getState<T>(key: string): T | null {
    return this.status[key] ?? null;
  }

  // Eliminar un estado
  removeState(key: string): void {
    delete this.status[key];
    this.saveToLocalStorage();
    this.emitStatusChange(); // Emitir cambios
  }

  // Limpiar todos los estados
  clearState(): void {
    this.status = {};
    localStorage.removeItem(this.statusKey);
    this.emitStatusChange(); // Emitir cambios
  }

  // Guardar el estado actual en localStorage
  private saveToLocalStorage(): void {
    localStorage.setItem(this.statusKey, JSON.stringify(this.status));
  }

  // Cargar el estado desde localStorage al iniciar el servicio
  private loadFromLocalStorage(): void {
    const storedStatus = localStorage.getItem(this.statusKey);
    if (storedStatus) {
      this.status = JSON.parse(storedStatus);
    }
    this.emitStatusChange(); // Emitir cambios al cargar
  }

  // Emitir el evento de cambio de estado
  private emitStatusChange(): void {
    this.statusChangeSubject.next(this.status);
  }
}
