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
  iccidList: string[] = [];
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
    const file = target.files?.[0];
    if (!file) return;

    this.hasVerified = false;
    this.verifiedList = [];
    this.registeredList = { active: [], canceled: [], expired: [], suspended: [], counts: {} };
    this.unregisteredList = [];
    this.duplicatedList = [];
    this.parseExcel(file);
    target.value = '';
  }

  parseExcel(file: File) {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      const bstr: string = e.target.result;
      const wb: xlsx.WorkBook = xlsx.read(bstr, { type: 'binary' });
      const wsname: string = wb.SheetNames[0];
      const ws: xlsx.WorkSheet = wb.Sheets[wsname];

      this.parsedData = xlsx.utils.sheet_to_json(ws);

      const iccids: string[] = [];
      for (const row of this.parsedData) {
        let keyToUse = Object.keys(row).find(k => k.toLowerCase().trim() === 'iccid');
        
        // Fallback al campo "telefono2" si "iccid" no viene en el excel
        if (!keyToUse) {
           keyToUse = Object.keys(row).find(k => k.toLowerCase().trim() === 'telefono2');
        }

        if (keyToUse && row[keyToUse]) {
          iccids.push(String(row[keyToUse]).trim());
        }
      }

      this.iccidList = iccids;
      this.displayList = [...iccids];
      
      // Auto-trigger verification
      if (this.iccidList.length > 0) {
         this.verifyIccids();
      }
    };

    reader.readAsBinaryString(file);
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
          ICCID: i.iccid
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
      const matchedDevices = await this.targetsService.bulkVerifyIccids(this.iccidList);
      
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
      this.verifiedList = this.iccidList.map(iccid => {
        // Find ALL matches for this specific iccid in the matched devices
        const matches = matchedDevices.filter((d: any) => d.sim_card_number === iccid);
        
        if (matches.length > 0) {
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

          const item: any = {
            iccid,
            isRegistered: true,
            deviceName: firstMatch.name,
            deviceImei: firstMatch.device_imei,
            plateNumber: firstMatch.target_plate_number,
            allMatches: enrichedMatches,
            deviceStatusType
          };

          registeredTemp.push(item);

          if (matches.length > 1) {
            duplicatedInDB++;
            this.duplicatedList.push(item);
          }
          
          return item;
        } else {
          unregisteredCount++;
          const item = {
            iccid,
            isRegistered: false
          };
          this.unregisteredList.push(item);
          return item;
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
