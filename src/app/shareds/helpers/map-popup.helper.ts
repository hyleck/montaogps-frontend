// utils/popup-builder.ts

export class PopupBuilder {
      static buildPopupHtml({
    title,
    vehicleType,
    speedKmh,
    status,
    stopTime,
    lastLocationDate,
    width = 250,
    markerId
  }: {
    title: string;
    vehicleType?: string;
    speedKmh: number;
    status: 'online' | 'offline' | string;
    stopTime?: string;
    lastLocationDate?: string;
    width?: number;
    markerId?: string;
  }): string {
      const vehicleTypeHtml = vehicleType && vehicleType !== 'Desconocido'
        ? `<span style="color: #9C27B0; font-size: 11px; margin-left: 4px;">(${vehicleType})</span>`
        : '';
  
      const formattedSpeed = speedKmh === 0 ? 'Estacionado' : `${speedKmh} km/h`;
      const statusColor = status === 'online' ? '#4CAF50' : '#F44336';
      const statusLabel = status === 'online' ? 'Conectado' : 'Desconectado';

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
          margin-top: 10px;
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
          margin-top: ${stopTimeContent ? '8px' : '10px'};
        ">
          <span style="color: #666; font-size: 12px;">📍 Última ubicación</span>
          <span style="color: #ff5722; font-weight: 600; font-size: 12px;">${lastLocationDate}</span>
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
            ${stopTimeContent}
            ${lastLocationContent}
          </div>
        </div>
      `;
    }

    // Método para agregar dinámicamente la sección de tiempo de parada con animación
    static addStopTimeWithAnimation(popupElement: HTMLElement, stopTime: string, speedKmh?: number): void {
      // No mostrar tiempo de parada si la velocidad es mayor a 0
      if (speedKmh !== undefined && speedKmh > 0) {
        console.log('🚗 Velocidad mayor a 0 km/h, no mostrar tiempo de parada');
        return;
      }

      const contentDiv = popupElement.querySelector('#popup-content');
      if (!contentDiv) return;

      // Verificar si ya existe la sección de tiempo de parada
      const existingStopTime = contentDiv.querySelector('#stop-time-section');
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
        padding: 8px 10px;
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

      // Agregar al contenido
      contentDiv.appendChild(stopTimeDiv);

      // Activar animación después de un breve delay
      setTimeout(() => {
        stopTimeDiv.style.opacity = '1';
        stopTimeDiv.style.transform = 'translateY(0)';
      }, 50);
    }

    // Método para mostrar skeleton mientras carga el tiempo de parada
    static addStopTimeSkeletonWithAnimation(popupElement: HTMLElement, speedKmh?: number): void {
      // No mostrar skeleton si la velocidad es mayor a 0
      if (speedKmh !== undefined && speedKmh > 0) {
        console.log('🚗 Velocidad mayor a 0 km/h, no mostrar skeleton de tiempo de parada');
        return;
      }

      console.log('💀 addStopTimeSkeletonWithAnimation iniciado');
      const contentDiv = popupElement.querySelector('#popup-content');
      if (!contentDiv) {
        console.log('❌ No se encontró #popup-content');
        return;
      }
      console.log('✅ #popup-content encontrado');

      // Verificar si ya existe la sección (skeleton o real)
      const existingStopTime = contentDiv.querySelector('#stop-time-section');
      if (existingStopTime) {
        console.log('⚠️ Ya existe #stop-time-section, saltando');
        return;
      }
      console.log('✅ No existe #stop-time-section, creando skeleton');

      // Crear la sección skeleton
      const skeletonDiv = document.createElement('div');
      skeletonDiv.id = 'stop-time-section';
      skeletonDiv.classList.add('stop-time-skeleton');
      skeletonDiv.style.cssText = `
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        padding: 8px 10px;
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

      // Agregar al contenido
      contentDiv.appendChild(skeletonDiv);
      console.log('✅ Skeleton agregado al DOM');

      // Activar animación después de un breve delay
      setTimeout(() => {
        skeletonDiv.style.opacity = '1';
        skeletonDiv.style.transform = 'translateY(0)';
        console.log('✅ Animación de skeleton activada');
      }, 50);
    }

    // Método para reemplazar skeleton con tiempo real o remover si no hay tiempo
    static replaceSkeletonWithStopTime(popupElement: HTMLElement, stopTime?: string, speedKmh?: number): void {
      const contentDiv = popupElement.querySelector('#popup-content');
      if (!contentDiv) return;

      const existingStopTime = contentDiv.querySelector('#stop-time-section');
      if (!existingStopTime) return;

      // Si no hay tiempo de parada válido O la velocidad es mayor a 0, remover el skeleton con animación
      if (!stopTime || (speedKmh !== undefined && speedKmh > 0)) {
        if (speedKmh !== undefined && speedKmh > 0) {
          console.log('🚗 Velocidad mayor a 0 km/h, removiendo sección de tiempo de parada');
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
    }

    // Método para remover la sección de tiempo de parada cuando el vehículo empiece a moverse
    static removeStopTimeSectionIfMoving(popupElement: HTMLElement, speedKmh: number): void {
      if (speedKmh > 0) {
        const contentDiv = popupElement.querySelector('#popup-content');
        if (!contentDiv) return;

        const existingStopTime = contentDiv.querySelector('#stop-time-section');
        if (existingStopTime) {
          console.log('🚗 Vehículo en movimiento, removiendo sección de tiempo de parada');
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
  }
  