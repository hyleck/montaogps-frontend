import { formatDeviceLabel } from 'src/app/shareds/pipes/device-label.pipe';
// utils/popup-builder.ts

export class PopupBuilder {
  // Hacer disponible globalmente para acceso desde componentes
  static {
    (window as any).PopupBuilder = PopupBuilder;
  }
      static buildPopupHtml({
    title,
    vehicleType,
    speedKmh,
    status,
    stopTime,
    lastLocationDate,
    width = 250,
    markerId,
    ignitionStatus,
    target
  }: {
    title: string;
    vehicleType?: string;
    speedKmh: number;
    status: 'online' | 'offline' | string;
    stopTime?: string;
    lastLocationDate?: string;
    width?: number;
    markerId?: string;
    ignitionStatus?: 'on' | 'off' | null;   
    target?: any;
  }): string {
      title = formatDeviceLabel(title);
      vehicleType = vehicleType ? formatDeviceLabel(vehicleType) : vehicleType;
      const vehicleTypeHtml = vehicleType && vehicleType !== 'Desconocido'
        ? `<span style="color: #9C27B0; font-size: 11px; margin-left: 4px;">(${vehicleType})</span>`
        : '';
  
      const formattedSpeed = speedKmh === 0 ? 'En línea' : `${speedKmh} km/h`;
      const statusColor = status === 'online' ? '#4CAF50' : '#F44336';
      const statusLabel = status === 'online' ? 'Conectado' : 'Desconectado';

      // Sección de estado de ignición (solo visible si el target tiene sensor configurado)
      // Calcular ignitionStatus rápidamente si no está disponible y tenemos target
      if (!ignitionStatus && target) {
        ignitionStatus = this.fastGetIgnitionStatus(target);
      }
      
      let ignitionContent = '';
      if (ignitionStatus !== null && ignitionStatus !== undefined) {
        const isEngineOn = ignitionStatus === 'on';
        const ignitionColor = isEngineOn ? '#4CAF50' : '#9E9E9E';
        const ignitionIcon = isEngineOn ? '🔋' : '⚫';
        const ignitionText = isEngineOn ? 'Encendido' : 'Apagado';
        
        ignitionContent = `
        <div id="ignition-section" style="
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          padding: 8px 10px;
          background: ${isEngineOn ? '#e8f5e8' : '#f5f5f5'};
          border-radius: 4px;
          border-left: 3px solid ${ignitionColor};
          width: 100%;
          box-sizing: border-box;
          margin-top: 10px;
        ">
          <span style="color: #666; font-size: 12px;">${ignitionIcon} Motor</span>
          <span style="color: ${ignitionColor}; font-weight: 600; font-size: 13px;">${ignitionText}</span>
        </div>
        `;
      }

      // Solo mostrar tiempo de parada cuando existe Y la velocidad es 0
      let stopTimeContent = '';
      if (stopTime && speedKmh === 0) {
        stopTimeContent = `
        <div id="stop-time-section" style="
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          padding: 8px 10px;
          background: #f8f9fa;
          border-radius: 4px;
          border-left: 3px solid #ff9800;
          width: 100%;
          box-sizing: border-box;
          margin-top: ${ignitionContent ? '8px' : '10px'};
        ">
          <span style="color: #666; font-size: 12px;">⏱️ Tiempo parado</span>
          <span style="color: #ff9800; font-weight: 600; font-size: 13px;">${stopTime}</span>
        </div>
        `;
      }

      // Determinar qué mostrar para la fecha de última ubicación (solo para dispositivos offline)
      let lastLocationContent = '';
      if (status === 'offline' && lastLocationDate) {
        lastLocationContent = `
        <div style="
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          padding: 8px 10px;
          background: #fff3e0;
          border-radius: 4px;
          border-left: 3px solid #ff5722;
          width: 100%;
          box-sizing: border-box;
          margin-top: ${stopTimeContent || ignitionContent ? '8px' : '10px'};
        ">
          <span style="color: #666; font-size: 12px;">📍 Última ubicación</span>
          <span style="color: #ff5722; font-weight: 600; font-size: 12px;">${lastLocationDate}</span>
        </div>
        `;
      }

      // Agregar información adicional que siempre esté presente
      const currentDate = new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      let additionalInfoContent = `
      <div style="
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        padding: 8px 10px;
        background: #f0f8ff;
        border-radius: 4px;
        border-left: 3px solid #2196F3;
        width: 100%;
        box-sizing: border-box;
        margin-top: ${lastLocationContent || stopTimeContent || ignitionContent ? '8px' : '10px'};
      ">
        <span style="color: #666; font-size: 12px;">📍 Última ubicación</span>
        <span style="color: #2196F3; font-weight: 600; font-size: 12px;">${currentDate}</span>
      </div>
      `;

      // Agregar información del vehículo si está disponible
      if (vehicleType && vehicleType !== 'Desconocido') {
        additionalInfoContent += `
        <div style="
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          padding: 8px 10px;
          background: #f3e5f5;
          border-radius: 4px;
          border-left: 3px solid #9C27B0;
          width: 100%;
          box-sizing: border-box;
          margin-top: 8px;
        ">
          <span style="color: #666; font-size: 12px;">🚗 Tipo</span>
          <span style="color: #9C27B0; font-weight: 600; font-size: 12px;">${vehicleType}</span>
        </div>
        `;
      }
  
      return `
        <div id="custom-info-window" style="
          font-family: 'Segoe UI', sans-serif; 
          width: ${width}px; 
          max-width: ${width}px;
          background: white; 
          border: 1px solid #e0e0e0;
          border-radius: 4px; 
          margin: 0 10px 10px 0;
          box-sizing: border-box;
          overflow: hidden;
        ">
          <div style="
            background: #f8f9fa; 
            color: #333; 
            padding: 10px 12px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            border-bottom: 1px solid #e0e0e0;
            box-sizing: border-box;
            width: 100%;
          ">
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-size: 14px; 
                font-weight: 500; 
                color: #333;
                white-space: nowrap; 
                overflow: hidden; 
                text-overflow: ellipsis;
              ">
                ${title}${vehicleTypeHtml}
              </div>
            </div>
            <button onclick="
              // Cerrar popup correctamente según el proveedor
              const popupElement = this.closest('[id^=custom-info-window]');
              if (popupElement) {
                // Para Google Maps InfoWindow
                const gmapsContainer = popupElement.closest('.gm-style-iw');
                if (gmapsContainer) {
                  const closeBtn = gmapsContainer.querySelector('.gm-ui-hover-effect');
                  if (closeBtn) {
                    closeBtn.click();
                  } else {
                    // Fallback: ocultar el contenedor padre
                    const iwContainer = gmapsContainer.parentElement;
                    if (iwContainer) iwContainer.style.display = 'none';
                  }
                } else {
                  // Para Mapbox popup
                  const mapboxPopup = popupElement.closest('.mapboxgl-popup');
                  if (mapboxPopup) {
                    mapboxPopup.remove();
                  } else {
                    // Fallback general
                    popupElement.style.display = 'none';
                  }
                }
              }
            "
                    style="
                      background: none; 
                      border: none; 
                      color: #666; 
                      width: 20px; 
                      height: 20px; 
                      cursor: pointer; 
                      font-size: 16px; 
                      line-height: 1; 
                      margin-left: 10px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      flex-shrink: 0;
                    "
                    onmouseover="this.style.color='#333'"
                    onmouseout="this.style.color='#666'">
              ×
            </button>
          </div>
          <div id="popup-content" style="padding: 12px; box-sizing: border-box; width: 100%;">
            <div style="
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              margin-bottom: 10px;
              width: 100%;
              box-sizing: border-box;
            ">
              <span style="color: #666; font-size: 13px;">Velocidad</span>
              <span style="color: #333; font-weight: 600; font-size: 18px;">${formattedSpeed}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor};"></span>
              <span style="color: #666; font-size: 13px;">${statusLabel}</span>
            </div>
            
            <!-- Botón Más información (siempre visible ya que siempre hay contenido adicional) -->
            <div id="more-info-button" style="
              margin-top: 12px;
              padding: 8px 12px;
              background: #f0f0f0;
              border: 1px solid #ddd;
              border-radius: 4px;
              cursor: pointer;
              text-align: center;
              transition: all 0.2s ease;
              user-select: none;
            " 
            onclick="
              const button = this;
              const detailsSection = document.getElementById('details-section');
              const icon = document.getElementById('more-info-icon');
              
              if (detailsSection.style.display === 'none' || detailsSection.style.display === '') {
                // Mostrar detalles
                detailsSection.style.display = 'block';
                setTimeout(() => {
                  detailsSection.style.opacity = '1';
                  detailsSection.style.transform = 'translateY(0)';
                }, 10);
                button.querySelector('span').textContent = 'Menos información';
                icon.textContent = '▲';
                button.style.background = '#e3f2fd';
                button.style.borderColor = '#2196F3';
              } else {
                // Ocultar detalles
                detailsSection.style.opacity = '0';
                detailsSection.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                  detailsSection.style.display = 'none';
                }, 300);
                button.querySelector('span').textContent = 'Más información';
                icon.textContent = '▼';
                button.style.background = '#f0f0f0';
                button.style.borderColor = '#ddd';
              }
            "
            onmouseover="
              if (this.style.background !== 'rgb(227, 242, 253)') {
                this.style.background = '#e8e8e8';
              }
            "
            onmouseout="
              if (this.style.background !== 'rgb(227, 242, 253)') {
                this.style.background = '#f0f0f0';
              }
            ">
              <span style="color: #666; font-size: 12px; font-weight: 500;">Más información</span>
              <span id="more-info-icon" style="color: #666; font-size: 10px; margin-left: 8px;">▼</span>
            </div>
            
            <!-- Sección de detalles (inicialmente oculta) -->
            <div id="details-section" style="
              display: none;
              opacity: 0;
              transform: translateY(-10px);
              transition: all 0.3s ease;
              margin-top: 8px;
            ">
              ${ignitionContent}
            ${stopTimeContent}
            ${lastLocationContent}
            ${additionalInfoContent}
            </div>
          </div>
        </div>
      `;
    }

    // Método para agregar dinámicamente la sección de tiempo de parada con animación
    static addStopTimeWithAnimation(popupElement: HTMLElement, stopTime: string, speedKmh?: number, ignitionStatus?: 'on' | 'off' | null): void {
      // No mostrar tiempo de parada si la velocidad es mayor a 0
      if (speedKmh !== undefined && speedKmh > 0) {
        // console.log('🚗 Velocidad mayor a 0 km/h, no mostrar tiempo de parada');
        return;
      }

      const contentDiv = popupElement.querySelector('#popup-content');
      if (!contentDiv) return;

      // Buscar la sección de detalles donde se debe agregar la información
      let detailsSection = contentDiv.querySelector('#details-section') as HTMLElement;
      if (!detailsSection) {
        // console.warn('⚠️ No se encontró #details-section, usando #popup-content como fallback');
        detailsSection = contentDiv as HTMLElement;
      }

      // PRIMERO: Agregar o actualizar la sección de ignición si está disponible
      this.addOrUpdateIgnitionSection(detailsSection, ignitionStatus);

      // Verificar si ya existe la sección de tiempo de parada
      const existingStopTime = detailsSection.querySelector('#stop-time-section');
      if (existingStopTime) {
        // Si ya existe, solo actualizar el texto
        const timeSpan = existingStopTime.querySelector('span:last-child') as HTMLElement;
        if (timeSpan) {
          timeSpan.textContent = stopTime;
        }
        return;
      }

      // Crear la nueva sección de tiempo de parada
      const stopTimeDiv = document.createElement('div');
      stopTimeDiv.id = 'stop-time-section';
      stopTimeDiv.style.cssText = `
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
    
        background: #f8f9fa;
        border-radius: 4px;
        border-left: 3px solid #ff9800;
        width: 100%;
        box-sizing: border-box;
        margin-top: 10px;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease-out;
      `;

      stopTimeDiv.innerHTML = `
        <span style="color: #666; font-size: 12px;">⏱️ Tiempo parado</span>
        <span style="color: #ff9800; font-weight: 600; font-size: 13px;">${stopTime}</span>
      `;

      // Agregar al contenido (a la sección de detalles)
      detailsSection.appendChild(stopTimeDiv);

      // Mostrar el botón "Más información" si no está visible
      this.showMoreInfoButtonIfNeeded(popupElement);

      // Activar animación después de un breve delay
      setTimeout(() => {
        stopTimeDiv.style.opacity = '1';
        stopTimeDiv.style.transform = 'translateY(0)';
        
        // Reconfigurar eventos del botón "Más información" después de la animación
        setTimeout(() => this.showMoreInfoButtonIfNeeded(popupElement), 10);
      }, 50);
    }

    // Método para mostrar skeleton mientras carga el tiempo de parada
    static addStopTimeSkeletonWithAnimation(popupElement: HTMLElement, speedKmh?: number): void {
      // No mostrar skeleton si la velocidad es mayor a 0
      if (speedKmh !== undefined && speedKmh > 0) {
        // console.log('🚗 Velocidad mayor a 0 km/h, no mostrar skeleton de tiempo de parada');
        return;
      }

      // console.log('💀 addStopTimeSkeletonWithAnimation iniciado');
      const contentDiv = popupElement.querySelector('#popup-content');
      if (!contentDiv) {
        // console.log('❌ No se encontró #popup-content');
        return;
      }
      // console.log('✅ #popup-content encontrado');

      // Buscar la sección de detalles donde se debe agregar la información
      let detailsSection = contentDiv.querySelector('#details-section') as HTMLElement;
      if (!detailsSection) {
        // console.warn('⚠️ No se encontró #details-section, usando #popup-content como fallback');
        detailsSection = contentDiv as HTMLElement;
      }

      // Verificar si ya existe la sección (skeleton o real)
      const existingStopTime = detailsSection.querySelector('#stop-time-section');
      if (existingStopTime) {
        // console.log('⚠️ Ya existe #stop-time-section, saltando');   
        return;
      }
      // console.log('✅ No existe #stop-time-section, creando skeleton');

      // Crear la sección skeleton
      const skeletonDiv = document.createElement('div');
      skeletonDiv.id = 'stop-time-section';
      skeletonDiv.classList.add('stop-time-skeleton');
      skeletonDiv.style.cssText = `
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        background: #f8f9fa;
        border-radius: 4px;
        border-left: 3px solid #ff9800;
        width: 100%;
        box-sizing: border-box;
        margin-top: 10px;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease-out;
      `;

      skeletonDiv.innerHTML = `
        <span style="color: #666; font-size: 12px;">⏱️ Tiempo parado</span>
        <div class="skeleton-text" style="
          height: 13px;
          width: 80px;
          background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite;
          border-radius: 4px;
        "></div>
      `;

      // Agregar estilos CSS para la animación del skeleton
      if (!document.querySelector('#skeleton-styles')) {
        const style = document.createElement('style');
        style.id = 'skeleton-styles';
        style.textContent = `
          @keyframes skeleton-loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `;
        document.head.appendChild(style);
      }

      // Agregar al contenido (a la sección de detalles)
      detailsSection.appendChild(skeletonDiv);
      // console.log('✅ Skeleton agregado al DOM');

      // Mostrar el botón "Más información" si no está visible
      this.showMoreInfoButtonIfNeeded(popupElement);

      // Activar animación después de un breve delay
      setTimeout(() => {
        skeletonDiv.style.opacity = '1';
        skeletonDiv.style.transform = 'translateY(0)';
        // console.log('✅ Animación de skeleton activada');
      }, 50);
    }

    // Método para reemplazar skeleton con tiempo real o remover si no hay tiempo
    static replaceSkeletonWithStopTime(popupElement: HTMLElement, stopTime?: string, speedKmh?: number, ignitionStatus?: 'on' | 'off' | null): void {
      const contentDiv = popupElement.querySelector('#popup-content');
      if (!contentDiv) return;

      // Buscar la sección de detalles donde se debe agregar la información
      let detailsSection = contentDiv.querySelector('#details-section') as HTMLElement;
      if (!detailsSection) {
        // console.warn('⚠️ No se encontró #details-section, usando #popup-content como fallback');
        detailsSection = contentDiv as HTMLElement;
      }

      // PRIMERO: Agregar o actualizar la sección de ignición si está disponible
      this.addOrUpdateIgnitionSection(detailsSection, ignitionStatus);

      const existingStopTime = detailsSection.querySelector('#stop-time-section');
      if (!existingStopTime) return;

      // Si no hay tiempo de parada válido O la velocidad es mayor a 0, remover el skeleton con animación
      if (!stopTime || (speedKmh !== undefined && speedKmh > 0)) {
        if (speedKmh !== undefined && speedKmh > 0) {
          // console.log('🚗 Velocidad mayor a 0 km/h, removiendo sección de tiempo de parada');
        }
        const stopTimeElement = existingStopTime as HTMLElement;
        stopTimeElement.style.opacity = '0';
        stopTimeElement.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          if (stopTimeElement.parentNode) {
            stopTimeElement.parentNode.removeChild(stopTimeElement);
          }
        }, 300); // Tiempo de la transición CSS
        return;
      }

      // Si es skeleton, reemplazar con contenido real
      if (existingStopTime.classList.contains('stop-time-skeleton')) {
        const timeSpan = existingStopTime.querySelector('.skeleton-text');
        if (timeSpan) {
          // Reemplazar el skeleton con el tiempo real
          timeSpan.outerHTML = `<span style="color: #ff9800; font-weight: 600; font-size: 13px;">${stopTime}</span>`;
          existingStopTime.classList.remove('stop-time-skeleton');
        }
      } else {
        // Si ya es contenido real, solo actualizar
        const timeSpan = existingStopTime.querySelector('span:last-child') as HTMLElement;
        if (timeSpan) {
          timeSpan.textContent = stopTime;
        }
      }
      
      // Reconfigurar eventos del botón "Más información" después de la actualización
      setTimeout(() => this.showMoreInfoButtonIfNeeded(popupElement), 10);
    }

    // Método para remover la sección de tiempo de parada cuando el vehículo empiece a moverse
    static removeStopTimeSectionIfMoving(popupElement: HTMLElement, speedKmh: number): void {
      if (speedKmh > 0) {
        const contentDiv = popupElement.querySelector('#popup-content');
        if (!contentDiv) return;

        // Buscar la sección de detalles donde se debe buscar la información
        let detailsSection = contentDiv.querySelector('#details-section') as HTMLElement;
        if (!detailsSection) {
          detailsSection = contentDiv as HTMLElement;
        }

        const existingStopTime = detailsSection.querySelector('#stop-time-section');
        if (existingStopTime) {
          // console.log('🚗 Vehículo en movimiento, removiendo sección de tiempo de parada');
          const stopTimeElement = existingStopTime as HTMLElement;
          stopTimeElement.style.opacity = '0';
          stopTimeElement.style.transform = 'translateY(-10px)';
          setTimeout(() => {
            if (stopTimeElement.parentNode) {
              stopTimeElement.parentNode.removeChild(stopTimeElement);
            }
          }, 300); // Tiempo de la transición CSS
                }
      }
    }

      // Método auxiliar para agregar o actualizar la sección de ignición (optimizado)
  static addOrUpdateIgnitionSection(contentDiv: Element, ignitionStatus?: 'on' | 'off' | null): void {
    // console.log('🔋 DEBUG addOrUpdateIgnitionSection llamado con ignitionStatus:', ignitionStatus);
    // console.log('🔋 DEBUG contentDiv:', contentDiv ? 'existe' : 'null/undefined');
    
    if (ignitionStatus === null || ignitionStatus === undefined) {
        // console.log('🔋 DEBUG: ignitionStatus es null/undefined, buscando sección existente para remover');
      // Si no hay estado de ignición, remover la sección si existe
      const existingIgnition = contentDiv.querySelector('#ignition-section');
      if (existingIgnition) {
        //  console.log('🔋 DEBUG: Removiendo sección de ignición existente');
        existingIgnition.remove();
      } else {
        // console.log('🔋 DEBUG: No hay sección de ignición existente para remover');
      }
      return;
    }

      const isEngineOn = ignitionStatus === 'on';
      const ignitionColor = isEngineOn ? '#4CAF50' : '#9E9E9E';
      const ignitionIcon = isEngineOn ? '🔋' : '⚫';
      const ignitionText = isEngineOn ? 'Encendido' : 'Apagado';

      // Verificar si ya existe la sección de ignición
      const existingIgnition = contentDiv.querySelector('#ignition-section');
      if (existingIgnition) {
        // Si ya existe, solo actualizar el contenido
        const iconSpan = existingIgnition.querySelector('span:first-child') as HTMLElement;
        const textSpan = existingIgnition.querySelector('span:last-child') as HTMLElement;
        const ignitionDiv = existingIgnition as HTMLElement;
        
        if (iconSpan && textSpan && ignitionDiv) {
          iconSpan.textContent = `${ignitionIcon} Motor`;
          textSpan.textContent = ignitionText;
          textSpan.style.color = ignitionColor;
          ignitionDiv.style.background = isEngineOn ? '#e8f5e8' : '#f5f5f5';
          ignitionDiv.style.borderLeft = `3px solid ${ignitionColor}`;
        }
        return;
      }

      // Crear nueva sección de ignición
      const ignitionDiv = document.createElement('div');
      ignitionDiv.id = 'ignition-section';
      ignitionDiv.style.cssText = `
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        background: ${isEngineOn ? '#e8f5e8' : '#f5f5f5'};
        border-radius: 4px;
        border-left: 3px solid ${ignitionColor};
        width: 100%;
        box-sizing: border-box;
        margin-top: 10px;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease-out;
      `;

      ignitionDiv.innerHTML = `
        <span style="color: #666; font-size: 12px;">${ignitionIcon} Motor</span>
        <span style="color: ${ignitionColor}; font-weight: 600; font-size: 13px;">${ignitionText}</span>
      `;

      // Insertar la sección de ignición ANTES de la sección de tiempo de parada (si existe)
      const stopTimeSection = contentDiv.querySelector('#stop-time-section');
      if (stopTimeSection) {
        contentDiv.insertBefore(ignitionDiv, stopTimeSection);
      } else {
        contentDiv.appendChild(ignitionDiv);
      }

            // Activar animación después de un breve delay
      setTimeout(() => {
        ignitionDiv.style.opacity = '1';
        ignitionDiv.style.transform = 'translateY(0)';
        
        // Reconfigurar eventos del botón "Más información" después de la animación
        const popupElement = contentDiv.closest('#custom-info-window') as HTMLElement;
        if (popupElement) {
          setTimeout(() => this.showMoreInfoButtonIfNeeded(popupElement), 10);
        }
      }, 50);

      // Mostrar el botón "Más información" si no está visible (ejecución inmediata)
      const popupElement = contentDiv.closest('#custom-info-window') as HTMLElement;
      if (popupElement) {
        this.showMoreInfoButtonIfNeeded(popupElement);
      }
     }

     // Método auxiliar para mostrar el botón "Más información" - ahora siempre visible
     static showMoreInfoButtonIfNeeded(popupElement: HTMLElement): void {
       const moreInfoButton = popupElement.querySelector('#more-info-button') as HTMLElement;
       
       if (moreInfoButton) {
         // El botón siempre debe estar visible ya que siempre hay contenido adicional
         moreInfoButton.style.display = 'block';
       }
     }

     // Método para preservar el estado expandido/colapsado durante actualizaciones
     static preserveMoreInfoState(oldPopupElement: HTMLElement, newPopupHtml: string): string {
       try {
         const oldButton = oldPopupElement?.querySelector('#more-info-button');
         const oldDetailsSection = oldPopupElement?.querySelector('#details-section') as HTMLElement;
         
         if (!oldButton || !oldDetailsSection) {
           return newPopupHtml;
         }

         // Verificar si estaba expandido usando múltiples métodos
         const wasExpanded = oldDetailsSection.style.display === 'block' || 
                           oldDetailsSection.style.opacity === '1' ||
                           oldDetailsSection.offsetHeight > 0 ||
                           !oldDetailsSection.style.display.includes('none');
         
         if (wasExpanded) {
           // Modificar el HTML nuevo para que aparezca expandido
           let modifiedHtml = newPopupHtml;
           
           // Cambiar el estado inicial de la sección de detalles
           modifiedHtml = modifiedHtml.replace(
             /display: none;[\s]*opacity: 0;[\s]*transform: translateY\(-10px\);/,
             'display: block; opacity: 1; transform: translateY(0);'
           );
           
           // Cambiar el texto del botón
           modifiedHtml = modifiedHtml.replace(
             'Más información',
             'Menos información'
           );
           
           // Cambiar el ícono
           modifiedHtml = modifiedHtml.replace(
             '>▼<',
             '>▲<'
           );
           
           // Cambiar los estilos del botón para mostrar estado activo
           modifiedHtml = modifiedHtml.replace(
             'background: #f0f0f0;',
             'background: #e3f2fd;'
           );
           
           modifiedHtml = modifiedHtml.replace(
             'border: 1px solid #ddd;',
             'border: 1px solid #2196F3;'
           );
           
           return modifiedHtml;
         }
         
         return newPopupHtml;
         
       } catch (error) {
         //     console.warn('⚠️ Error preservando estado del popup:', error);
         return newPopupHtml;
      }
    }   

      // Método para actualizar elementos específicos del popup sin regenerar HTML
  static updatePopupElementsDirectly(popupElement: HTMLElement, updates: {
    title?: string;
    speedKmh?: number;
    status?: 'online' | 'offline' | string;
    stopTime?: string | null;
    ignitionStatus?: 'on' | 'off' | null;
  }): void {
    try {
      // Actualizar título
      if (updates.title !== undefined) {
        const titleElement = popupElement.querySelector('.popup-title, [style*="font-size: 14px"]');
        if (titleElement) {
          // Preservar el HTML del tipo de vehículo si existe
          const vehicleTypeHtml = titleElement.innerHTML.match(/<span[^>]*>\([^)]+\)<\/span>/);
          titleElement.innerHTML = formatDeviceLabel(updates.title) + (vehicleTypeHtml ? vehicleTypeHtml[0] : '');
        }
      }

      // Actualizar velocidad
      if (updates.speedKmh !== undefined) {
        const speedText = updates.speedKmh === 0 ? 'En línea' : `${updates.speedKmh} km/h`;
        const speedElements = popupElement.querySelectorAll('[style*="color: #333"]');
        speedElements.forEach(element => {
          if (element.textContent?.includes('km/h') || element.textContent?.includes('Estacionado') || element.textContent?.includes('En línea')) {
            element.textContent = speedText;
          }
        });
      }

      // Actualizar estado
      if (updates.status !== undefined) {
        const statusColor = updates.status === 'online' ? '#4CAF50' : '#F44336';
        const statusLabel = updates.status === 'online' ? 'Conectado' : 'Desconectado';
        const statusElements = popupElement.querySelectorAll('[style*="color: #4CAF50"], [style*="color: #F44336"]');
        statusElements.forEach(element => {
          if (element.textContent?.includes('Conectado') || element.textContent?.includes('Desconectado')) {
            element.textContent = statusLabel;
            const elementStyle = element as HTMLElement;
            elementStyle.style.color = statusColor;
          }
        });
      }

      // Actualizar tiempo de parada
      if (updates.stopTime !== undefined) {
        const stopTimeSection = popupElement.querySelector('#stop-time-section');
        if (updates.stopTime === null) {
          // Limpiar tiempo de parada (target nuevo)
          if (stopTimeSection) {
            this.removeStopTimeSectionIfMoving(popupElement, 999); // Usar velocidad alta para forzar remoción
          }
        } else if (updates.stopTime && (updates.speedKmh === 0 || updates.speedKmh === undefined)) {
          // Mostrar tiempo de parada si existe y la velocidad es 0 o no está definida
          if (stopTimeSection) {
            // Actualizar sección existente
            const timeValue = stopTimeSection.querySelector('[style*="color: #ff9800"]');
            if (timeValue) {
              timeValue.textContent = updates.stopTime;
            }
          } else {
            // Crear nueva sección de tiempo de parada
            this.addStopTimeWithAnimation(popupElement, updates.stopTime, updates.speedKmh, updates.ignitionStatus);
          }
        } else if (stopTimeSection && updates.speedKmh && updates.speedKmh > 0) {
          // Remover sección si el vehículo está en movimiento
          this.removeStopTimeSectionIfMoving(popupElement, updates.speedKmh);
        }
      }

      // Actualizar estado de ignición
      if (updates.ignitionStatus !== undefined) {
        const contentDiv = popupElement.querySelector('#popup-content');
        if (contentDiv) {
          this.addOrUpdateIgnitionSection(contentDiv, updates.ignitionStatus);
        }
      }

    } catch (error) {
      console.warn('⚠️ Error actualizando popup directamente:', error);
    }
  }

  // Método auxiliar rápido para obtener estado de ignición
  private static fastGetIgnitionStatus(target: any): 'on' | 'off' | null {
    // BUSCAR ignition_sensor en el target principal o en originalTarget
    let ignitionSensor = target?.ignition_sensor;
    if (!ignitionSensor && target?.originalTarget) {
      ignitionSensor = target.originalTarget.ignition_sensor;
    }
    
    // Solo procesar si tiene sensor configurado
    if (ignitionSensor !== 'yes') {
      return null;
    }
      
      // Búsqueda rápida en ubicaciones conocidas
      const ignitionValue = target?.traccarInfo?.geolocation?.attributes?.ignition ??
                           target?.traccarInfo?.attributes?.ignition ??
                           target?.traccarInfo?.geolocation?.ignition;
      
      if (ignitionValue !== undefined && ignitionValue !== null) {
        return ignitionValue ? 'on' : 'off';
      }
      
      // Inferir por velocidad como fallback
      const speed = target?.traccarInfo?.geolocation?.speed || 0;
      return speed > 0 ? 'on' : 'off';
    }
  }
