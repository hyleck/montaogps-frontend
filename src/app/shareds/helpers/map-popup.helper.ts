// utils/popup-builder.ts

export class PopupBuilder {
      static buildPopupHtml({
    title,
    vehicleType,
    speedKmh,
    status,
    stopTime,
    width = 250,
    markerId
  }: {
    title: string;
    vehicleType?: string;
    speedKmh: number;
    status: 'online' | 'offline' | string;
    stopTime?: string;
    width?: number;
    markerId?: string;
  }): string {
      const vehicleTypeHtml = vehicleType && vehicleType !== 'Desconocido'
        ? `<span style="color: #9C27B0; font-size: 11px; margin-left: 4px;">(${vehicleType})</span>`
        : '';
  
      const formattedSpeed = speedKmh === 0 ? 'Estacionado' : `${speedKmh} km/h`;
      const statusColor = status === 'online' ? '#4CAF50' : '#F44336';
      const statusLabel = status === 'online' ? 'Conectado' : 'Desconectado';
  
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
          <div style="padding: 12px; box-sizing: border-box; width: 100%;">
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
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: ${stopTime ? '10px' : '0'};">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor};"></span>
              <span style="color: #666; font-size: 13px;">${statusLabel}</span>
            </div>
            ${stopTime ? `
            <div style="
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              padding: 8px 10px;
              background: #f8f9fa;
              border-radius: 4px;
              border-left: 3px solid #ff9800;
              width: 100%;
              box-sizing: border-box;
            ">
              <span style="color: #666; font-size: 12px;">⏱️ Tiempo parado</span>
              <span style="color: #ff9800; font-weight: 600; font-size: 13px;">${stopTime}</span>
            </div>
            ` : ''}
          </div>
        </div>
      `;
    }
  }
  