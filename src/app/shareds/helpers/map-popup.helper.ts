// utils/popup-builder.ts

export class PopupBuilder {
    static buildPopupHtml({
      title,
      vehicleType,
      speedKmh,
      status,
      width = 230
    }: {
      title: string;
      vehicleType?: string;
      speedKmh: number;
      status: 'online' | 'offline' | string;
      width?: number;
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
          background: white; 
          border: 1px solid #e0e0e0;
          border-radius: 4px; 
          margin: 0 10px 10px 0;
        ">
          <div style="
            background: #f8f9fa; 
            color: #333; 
            padding: 10px 12px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            border-bottom: 1px solid #e0e0e0;
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
            <button onclick="this.closest('[id^=custom-info-window]').style.display = 'none'"
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
          <div style="padding: 12px;">
            <div style="
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              margin-bottom: 10px; 
            ">
              <span style="color: #666; font-size: 13px;">Velocidad</span>
              <span style="color: #333; font-weight: 600; font-size: 18px;">${formattedSpeed}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor};"></span>
              <span style="color: #666; font-size: 13px;">${statusLabel}</span>
            </div>
          </div>
        </div>
      `;
    }
  }
  