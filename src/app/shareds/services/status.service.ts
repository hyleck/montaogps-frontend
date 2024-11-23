import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StatusService {
  private statusKey = 'appStatus'; // Clave para el localStorage
  private status: any = {}; // Estado en memoria

  constructor() {
    this.loadFromLocalStorage();
  }

  // Guardar un estado
  setState(key: string, value: any): void {
    this.status[key] = value;
    this.saveToLocalStorage();
  }

  // Obtener un estado
  getState<T>(key: string): T | null {
    return this.status[key] ?? null;
  }

  // Eliminar un estado
  removeState(key: string): void {
    delete this.status[key];
    this.saveToLocalStorage();
  }

  // Limpiar todos los estados
  clearState(): void {
    this.status = {};
    localStorage.removeItem(this.statusKey);
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
  }
}
