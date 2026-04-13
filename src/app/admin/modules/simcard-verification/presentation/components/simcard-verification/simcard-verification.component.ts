import { Component } from '@angular/core';

import * as xlsx from 'xlsx';
import { TargetsService } from '../../../../../../core/services/targets.service';

export interface VerifiedIccid {
  iccid: string;
  isRegistered: boolean;
  deviceName?: string;
  deviceImei?: string;
  plateNumber?: string;
}

@Component({
  selector: 'app-simcard-verification',
  standalone: false,
  templateUrl: './simcard-verification.component.html',
  styleUrl: './simcard-verification.component.css'
})
export class SimcardVerificationComponent {
  parsedData: any[] = [];
  iccidList: any[] = [];
  verifiedList: VerifiedIccid[] = [];
  displayList: any[] = [];
  isVerifying: boolean = false;
  hasVerified: boolean = false;

  // Stats
  statsTotal: number = 0;
  statsRegistered: number = 0;
  statsUnregistered: number = 0;
  statsDuplicatedInDB: number = 0;

  // Categorized lists
  registeredList: any = { active: [], canceled: [], expired: [], suspended: [], counts: {} };
  unregisteredList: any[] = [];
  duplicatedList: any[] = [];

  constructor(private targetsService: TargetsService) {}

  onFileSelect(event: any) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (!files || files.length === 0) return;

    this.hasVerified = false;
    this.verifiedList = [];
    this.registeredList = { active: [], canceled: [], expired: [], suspended: [], counts: {} };
    this.unregisteredList = [];
    this.duplicatedList = [];
    this.iccidList = [];

    const filePromises: Promise<{iccid: string, sourceFile: string}[]>[] = [];
    for (let i = 0; i < files.length; i++) {
       filePromises.push(this.parseExcelPromise(files[i]));
    }

    Promise.all(filePromises).then((results: {iccid: string, sourceFile: string}[][]) => {
       // Aplanar resultados de múltiples exceles
       this.iccidList = results.reduce((acc, val) => acc.concat(val), []);
       this.displayList = [...this.iccidList];
       
       target.value = '';

       // Disparar auto-verificación centralizada
       if (this.iccidList.length > 0) {
          this.verifyIccids();
       }
    }).catch(err => {
       console.error("Error al parsear matriz de archivos Excel", err);
       target.value = '';
    });
  }

  parseExcelPromise(file: File): Promise<{iccid: string, sourceFile: string}[]> {
    return new Promise((resolve, reject) => {
       const reader = new FileReader();

       reader.onload = (e: any) => {
          try {
             const bstr: string = e.target.result;
             const wb: xlsx.WorkBook = xlsx.read(bstr, { type: 'binary' });
             const wsname: string = wb.SheetNames[0];
             const ws: xlsx.WorkSheet = wb.Sheets[wsname];

             const parsedData = xlsx.utils.sheet_to_json(ws);
             const extracted: {iccid: string, sourceFile: string}[] = [];

             for (const row of parsedData as any[]) {
                let keyToUse = Object.keys(row).find(k => k.toLowerCase().trim() === 'iccid');
                if (!keyToUse) {
                   keyToUse = Object.keys(row).find(k => k.toLowerCase().trim() === 'telefono2');
                }
                if (keyToUse && row[keyToUse]) {
                   extracted.push({
                     iccid: String(row[keyToUse]).trim(),
                     sourceFile: file.name
                   });
                }
             }
             resolve(extracted);
          } catch(err) {
             reject(err);
          }
       };

       reader.onerror = (error) => reject(error);
       reader.readAsBinaryString(file);
    });
  }

  exportExcel(type: 'active' | 'canceled' | 'expired' | 'suspended' | 'unregistered' | 'duplicated') {
    let fileName = `Reporte_${type.toUpperCase()}_Simcards.xlsx`;

    if (type === 'duplicated') {
      const aoa: any[][] = [];
      
      this.duplicatedList.forEach((dup: any, idx: number) => {
        // Título de la Agrupación
        aoa.push([`${idx + 1}- ICCID Duplicado: ${dup.iccid} (${dup.allMatches.length} Conflictos)`]);
        
        // Cabecera Interna
        aoa.push(['#', 'Target en Conflicto', 'IMEI', 'Placa', 'Estado Real']);
        
        // Filas de Datos
        dup.allMatches.forEach((match: any, matchIdx: number) => {
          aoa.push([
            matchIdx + 1,
            match.name || 'N/A',
            match.device_imei || 'N/A',
            match.target_plate_number || 'N/A',
            (match.deviceStatusType || 'desconocido').toUpperCase()
          ]);
        });
        
        // Espaciador Visual
        aoa.push([]);
      });

      if (!aoa.length) return;
      const ws: xlsx.WorkSheet = xlsx.utils.aoa_to_sheet(aoa);
      const wb: xlsx.WorkBook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Duplicados');
      xlsx.writeFile(wb, fileName);

    } else {
      let dataToExport: any[] = [];
      
      if (type === 'unregistered') {
        dataToExport = this.unregisteredList.map((i: any) => ({
          ICCID: i.iccid,
          'Archivo Origen': i.sourceFile || 'Desconocido'
        }));
      } else {
        const sourceList = (this.registeredList as any)[type] || [];
        dataToExport = sourceList.map((i: any) => ({
          ICCID: i.iccid,
          'Dispositivo (Target)': i.deviceName || 'N/A',
          'IMEI': i.deviceImei || 'N/A',
          'Placa': i.plateNumber || 'N/A'
        }));
      }

      if (!dataToExport.length) return;
      const ws: xlsx.WorkSheet = xlsx.utils.json_to_sheet(dataToExport);
      const wb: xlsx.WorkBook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Datos');
      xlsx.writeFile(wb, fileName);
    }
  }

  async verifyIccids() {
    if (!this.iccidList.length) return;
    
    this.isVerifying = true;
    try {
      const iccidsForDb = this.iccidList.map(item => item.iccid);
      const matchedDevices = await this.targetsService.bulkVerifyIccids(iccidsForDb);
      
      let registeredCount = 0;
      let unregisteredCount = 0;
      let duplicatedInDB = 0;

      let registeredTemp: any[] = [];
      this.unregisteredList = [];
      this.duplicatedList = [];

      let activeCount = 0;
      let canceledCount = 0;
      let expiredCount = 0;
      let suspendedCount = 0;
      
      const now = new Date();

      // Build the display list
      this.verifiedList = this.iccidList.map(item => {
        const iccid = item.iccid;
        const sourceFile = item.sourceFile;

        // Find ALL matches for this specific iccid in the matched devices comparing without symbols
        const matches = matchedDevices.filter((d: any) => {
           if (!d.sim_card_number) return false;
           return String(d.sim_card_number).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === String(iccid).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        });
        
        if (matches.length > 0) {
           // ... (same as before)
           registeredCount++;
          
          // Enriquecemos todos los matches con su estado calculado
          const enrichedMatches = matches.map((m: any) => {
             let st = 'active';
             if (m.canceled) {
                st = 'canceled';
             } else if (new Date(m.expiration_date) <= now) {
                st = 'expired';
             } else if (m.status === false) {
                st = 'suspended';
             }
             return { ...m, deviceStatusType: st };
          });

          // Definimos el estado principal del ICCID basados en el primer match
          const firstMatch = enrichedMatches[0];
          let deviceStatusType = firstMatch.deviceStatusType;

          if (deviceStatusType === 'canceled') {
             canceledCount++;
          } else if (deviceStatusType === 'expired') {
             expiredCount++;
          } else if (deviceStatusType === 'suspended') {
             suspendedCount++;
          } else {
             activeCount++;
          }

          const registeredItem: any = {
            iccid,
            isRegistered: true,
            deviceName: firstMatch.name,
            deviceImei: firstMatch.device_imei,
            plateNumber: firstMatch.target_plate_number,
            allMatches: enrichedMatches,
            deviceStatusType
          };

          registeredTemp.push(registeredItem);

          if (matches.length > 1) {
            duplicatedInDB++;
            this.duplicatedList.push(registeredItem);
          }
          
          return registeredItem;
        } else {
          unregisteredCount++;
          const unregItem = {
            iccid,
            sourceFile,
            isRegistered: false
          };
          this.unregisteredList.push(unregItem);
          return unregItem;
        }
      });

      // Split registeredList logically for template
      this.registeredList = {
        active: registeredTemp.filter(i => i.deviceStatusType === 'active'),
        canceled: registeredTemp.filter(i => i.deviceStatusType === 'canceled'),
        expired: registeredTemp.filter(i => i.deviceStatusType === 'expired'),
        suspended: registeredTemp.filter(i => i.deviceStatusType === 'suspended'),
        counts: {
          active: activeCount,
          canceled: canceledCount,
          expired: expiredCount,
          suspended: suspendedCount
        }
      };

      this.statsTotal = this.iccidList.length;
      this.statsRegistered = registeredCount;
      this.statsUnregistered = unregisteredCount;
      this.statsDuplicatedInDB = duplicatedInDB;

      this.displayList = this.verifiedList;
      this.hasVerified = true;
    } catch (error) {
      console.error('Error verifying ICCIDs:', error);
    } finally {
      this.isVerifying = false;
    }
  }
}
