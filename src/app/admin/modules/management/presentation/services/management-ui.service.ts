import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface UIState {
  loading: boolean;
  userFormDisplay: boolean;
  targetFormDisplay: boolean;
  showMaps: boolean;
}

export interface ResponsiveState {
  isMobileView: boolean;
  screenWidth: number;
}

@Injectable({
  providedIn: 'root'
})
export class ManagementUIService {
  private readonly MOBILE_BREAKPOINT = 1120;

  // Estados principales de UI
  private uiState: UIState = {
    loading: true,
    userFormDisplay: false,
    targetFormDisplay: false,
    showMaps: false
  };

  // Estado responsive
  private responsiveState: ResponsiveState = {
    isMobileView: false,
    screenWidth: window.innerWidth
  };

  // Subjects para observar cambios
  private uiStateSubject = new BehaviorSubject<UIState>(this.uiState);
  private responsiveStateSubject = new BehaviorSubject<ResponsiveState>(this.responsiveState);

  constructor() {
    this.updateScreenSize();
  }

  // ===========================================
  // OBSERVABLES PÚBLICOS
  // ===========================================

  /**
   * Observable del estado de UI
   */
  get uiState$(): Observable<UIState> {
    return this.uiStateSubject.asObservable();
  }

  /**
   * Observable del estado responsive
   */
  get responsiveState$(): Observable<ResponsiveState> {
    return this.responsiveStateSubject.asObservable();
  }

  // ===========================================
  // GESTIÓN DE ESTADO DE CARGA
  // ===========================================

  /**
   * Establece el estado de carga
   */
  setLoading(loading: boolean): void {
    this.updateUIState({ loading });
  }

  /**
   * Obtiene el estado de carga actual
   */
  isLoading(): boolean {
    return this.uiState.loading;
  }

  // ===========================================
  // GESTIÓN DE FORMULARIOS
  // ===========================================

  /**
   * Muestra el formulario de usuario
   */
  showUserForm(): void {
    this.updateUIState({ userFormDisplay: true });
  }

  /**
   * Oculta el formulario de usuario
   */
  hideUserForm(): void {
    this.updateUIState({ userFormDisplay: false });
  }

  /**
   * Alterna la visibilidad del formulario de usuario
   */
  toggleUserForm(): void {
    this.updateUIState({ userFormDisplay: !this.uiState.userFormDisplay });
  }

  /**
   * Obtiene el estado del formulario de usuario
   */
  isUserFormVisible(): boolean {
    return this.uiState.userFormDisplay;
  }

  /**
   * Muestra el formulario de target
   */
  showTargetForm(): void {
    this.updateUIState({ targetFormDisplay: true });
  }

  /**
   * Oculta el formulario de target
   */
  hideTargetForm(): void {
    this.updateUIState({ targetFormDisplay: false });
  }

  /**
   * Alterna la visibilidad del formulario de target
   */
  toggleTargetForm(): void {
    this.updateUIState({ targetFormDisplay: !this.uiState.targetFormDisplay });
  }

  /**
   * Obtiene el estado del formulario de target
   */
  isTargetFormVisible(): boolean {
    return this.uiState.targetFormDisplay;
  }

  // ===========================================
  // GESTIÓN DE MAPAS
  // ===========================================

  /**
   * Muestra los mapas
   */
  showMaps(): void {
    this.updateUIState({ showMaps: true });
  }

  /**
   * Oculta los mapas
   */
  hideMaps(): void {
    this.updateUIState({ showMaps: false });
  }

  /**
   * Alterna la visibilidad de los mapas
   */
  toggleMaps(): void {
    this.updateUIState({ showMaps: !this.uiState.showMaps });
  }

  /**
   * Obtiene el estado de visibilidad de los mapas
   */
  areMapsVisible(): boolean {
    return this.uiState.showMaps;
  }

  /**
   * Activa mapas automáticamente si hay targets y es vista móvil
   */
  autoShowMapsIfMobileAndHasTargets(hasTargets: boolean): void {
    if (this.responsiveState.isMobileView && !this.uiState.showMaps && hasTargets) {
      this.showMaps();
    }
  }

  // ===========================================
  // GESTIÓN RESPONSIVE
  // ===========================================

  /**
   * Actualiza el tamaño de pantalla y estado responsive
   */
  updateScreenSize(): void {
    const screenWidth = window.innerWidth;
    const isMobileView = screenWidth < this.MOBILE_BREAKPOINT;
    
    const oldState = { ...this.responsiveState };
    this.responsiveState = {
      isMobileView,
      screenWidth
    };

    // Emitir cambio si hay diferencia
    if (oldState.isMobileView !== isMobileView || oldState.screenWidth !== screenWidth) {
      this.responsiveStateSubject.next({ ...this.responsiveState });
    }
  }

  /**
   * Verifica si está en vista móvil
   */
  isMobileView(): boolean {
    return this.responsiveState.isMobileView;
  }

  /**
   * Obtiene el ancho de pantalla actual
   */
  getScreenWidth(): number {
    return this.responsiveState.screenWidth;
  }

  /**
   * Obtiene el breakpoint móvil configurado
   */
  getMobileBreakpoint(): number {
    return this.MOBILE_BREAKPOINT;
  }

  // ===========================================
  // GESTIÓN DE ESTADOS COMPLEJOS
  // ===========================================

  /**
   * Resetea todos los formularios
   */
  resetAllForms(): void {
    this.updateUIState({
      userFormDisplay: false,
      targetFormDisplay: false
    });
  }

  /**
   * Resetea todo el estado de UI
   */
  resetAll(): void {
    this.uiState = {
      loading: false,
      userFormDisplay: false,
      targetFormDisplay: false,
      showMaps: false
    };
    this.uiStateSubject.next({ ...this.uiState });
  }

  /**
   * Establece un estado de UI inicial
   */
  initializeUIState(initialState: Partial<UIState>): void {
    this.uiState = {
      ...this.uiState,
      ...initialState
    };
    this.uiStateSubject.next({ ...this.uiState });
  }

  // ===========================================
  // GETTERS PARA ESTADO ACTUAL
  // ===========================================

  /**
   * Obtiene todo el estado de UI actual
   */
  getCurrentUIState(): UIState {
    return { ...this.uiState };
  }

  /**
   * Obtiene todo el estado responsive actual
   */
  getCurrentResponsiveState(): ResponsiveState {
    return { ...this.responsiveState };
  }

  /**
   * Verifica si algún formulario está visible
   */
  isAnyFormVisible(): boolean {
    return this.uiState.userFormDisplay || this.uiState.targetFormDisplay;
  }

  /**
   * Verifica si la UI está en estado "ocupado" (cargando o formularios abiertos)
   */
  isBusyState(): boolean {
    return this.uiState.loading || this.isAnyFormVisible();
  }

  // ===========================================
  // MÉTODOS PRIVADOS
  // ===========================================

  /**
   * Actualiza el estado de UI y emite el cambio
   */
  private updateUIState(changes: Partial<UIState>): void {
    this.uiState = {
      ...this.uiState,
      ...changes
    };
    this.uiStateSubject.next({ ...this.uiState });
  }
} 