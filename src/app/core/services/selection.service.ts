import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export type SelectedTargetsBulkAction = 'cancel' | 'suspend' | 'create-transfer';

@Injectable({
  providedIn: 'root'
})
export class SelectionService {
  private selectedTargetsSubject = new BehaviorSubject<any[]>([]);
  private selectedTargetsCountSubject = new BehaviorSubject<number>(0);
  private targetsUpdatedSubject = new BehaviorSubject<boolean>(false);
  private selectedTargetsBulkActionSubject = new Subject<SelectedTargetsBulkAction>();

  constructor() {}

  /**
   * Observable para escuchar cambios en los targets seleccionados
   */
  get selectedTargets$(): Observable<any[]> {
    return this.selectedTargetsSubject.asObservable();
  }

  /**
   * Observable para escuchar cambios en el número de targets seleccionados
   */
  get selectedTargetsCount$(): Observable<number> {
    return this.selectedTargetsCountSubject.asObservable();
  }

  /**
   * Observable para escuchar cuando se actualizan/restauran targets
   */
  get targetsUpdated$(): Observable<boolean> {
    return this.targetsUpdatedSubject.asObservable();
  }

  get selectedTargetsBulkAction$(): Observable<SelectedTargetsBulkAction> {
    return this.selectedTargetsBulkActionSubject.asObservable();
  }

  /**
   * Obtener el valor actual de targets seleccionados
   */
  get selectedTargetsValue(): any[] {
    return this.selectedTargetsSubject.value;
  }

  /**
   * Obtener el número actual de targets seleccionados
   */
  get selectedTargetsCountValue(): number {
    return this.selectedTargetsCountSubject.value;
  }

  /**
   * Actualizar la lista de targets seleccionados
   * @param targets Array de targets seleccionados
   */
  updateSelectedTargets(targets: any[]): void {
    this.selectedTargetsSubject.next(targets || []);
    this.selectedTargetsCountSubject.next((targets || []).length);
  }

  /**
   * Agregar un target a la selección
   * @param target Target a agregar
   */
  addSelectedTarget(target: any): void {
    const currentTargets = this.selectedTargetsSubject.value;
    const isAlreadySelected = currentTargets.some(t => t._id === target._id);
    
    if (!isAlreadySelected) {
      const updatedTargets = [...currentTargets, target];
      this.updateSelectedTargets(updatedTargets);
    }
  }

  /**
   * Remover un target de la selección
   * @param targetId ID del target a remover
   */
  removeSelectedTarget(targetId: string): void {
    const currentTargets = this.selectedTargetsSubject.value;
    const updatedTargets = currentTargets.filter(t => t._id !== targetId);
    this.updateSelectedTargets(updatedTargets);
  }

  /**
   * Limpiar toda la selección
   */
  clearSelection(): void {
    this.updateSelectedTargets([]);
  }

  /**
   * Verificar si hay al menos un target seleccionado
   */
  hasSelectedTargets(): boolean {
    return this.selectedTargetsCountValue > 0;
  }

  /**
   * Verificar si un target específico está seleccionado
   * @param targetId ID del target a verificar
   */
  isTargetSelected(targetId: string): boolean {
    return this.selectedTargetsValue.some(t => t._id === targetId);
  }

  /**
   * Notificar que se han actualizado/restaurado targets
   */
  notifyTargetsUpdated(): void {
    this.targetsUpdatedSubject.next(true);
  }

  requestSelectedTargetsBulkAction(action: SelectedTargetsBulkAction): void {
    this.selectedTargetsBulkActionSubject.next(action);
  }
}
