import { Component, OnInit } from '@angular/core';
import { VehicleBrandsService } from 'src/app/core/services/vehicle-brands.service';

@Component({
  selector: 'app-sectors-settings',
  templateUrl: './sectors-settings.component.html',
  styleUrls: ['./sectors-settings.component.css'],
  standalone: false
})
export class SectorsSettingsComponent implements OnInit {
  provinces: any[] = [];
  municipalities: any[] = [];
  sectors: any[] = [];
  sectorSearch: string = '';

  selectedProvince = '';
  selectedMunicipality = '';
  editingSector: any | null = null;
  sectorDialogVisible = false;

  isLoading = false;

  constructor(private api: VehicleBrandsService) {}

  async ngOnInit() {
    await this.loadProvinces();
  }

  async loadProvinces() {
    this.isLoading = true;
    try {
      this.provinces = await this.api.getProvinces();
    } finally {
      this.isLoading = false;
    }
  }

  async onProvinceChange() {
    this.selectedMunicipality = '';
    this.municipalities = [];
    this.sectors = [];
    if (!this.selectedProvince) return;
    this.isLoading = true;
    try {
      this.municipalities = await this.api.getMunicipalities(this.selectedProvince);
    } finally {
      this.isLoading = false;
    }
  }

  async onMunicipalityChange() {
    this.sectors = [];
    if (!this.selectedMunicipality || !this.selectedProvince) return;
    this.isLoading = true;
    try {
      this.sectors = await this.api.getSectors(this.selectedMunicipality, this.selectedProvince);
    } finally {
      this.isLoading = false;
    }
  }

  get filteredSectors(): any[] {
    const term = (this.sectorSearch || '').trim().toLowerCase();
    if (!term) return this.sectors;
    return this.sectors.filter(s =>
      String(s.name || '').toLowerCase().includes(term) ||
      String(s.identifier || '').toLowerCase().includes(term) ||
      String(s.code || '').toLowerCase().includes(term)
    );
  }

  openNewSectorDialog() {
    const nextCode = this.generateNextSectorCode();
    this.editingSector = { code: nextCode, identifier: `S-${nextCode}`, name: '', provinceCode: this.selectedProvince, municipalityCode: this.selectedMunicipality };
    this.sectorDialogVisible = true;
  }

  openEditSectorDialog(sector: any) {
    this.editingSector = { ...sector };
    this.sectorDialogVisible = true;
  }

  async saveSector() {
    if (!this.editingSector) return;
    // Normalizar referencias de provincia/municipio
    this.editingSector.provinceCode = this.selectedProvince;
    this.editingSector.municipalityCode = this.selectedMunicipality;
    const payload = {
      code: this.editingSector.code || '',
      identifier: this.editingSector.identifier || '',
      name: this.editingSector.name || '',
      provinceCode: this.selectedProvince,
      municipalityCode: this.selectedMunicipality
    };
    this.isLoading = true;
    try {
      if (this.sectors.find(s => s.code === this.editingSector.code)) {
        await this.api.updateSector(this.editingSector.code, payload);
      } else {
        await this.api.createSector(payload);
      }
      // refrescar lista
      this.sectors = await this.api.getSectors(this.selectedMunicipality, this.selectedProvince);
      this.sectorDialogVisible = false;
    } finally {
      this.isLoading = false;
    }
  }

  private generateNextSectorCode(): string {
    // Basado en el patrón del ejemplo: code = municipalityCode + secuencia de 2 dígitos
    const base = String(this.selectedMunicipality || '');
    if (!base) return '';
    const prefixLen = base.length;
    let maxSuffix = 0;
    for (const s of this.sectors) {
      const code: string = String(s.code || '');
      if (code.startsWith(base)) {
        const suffixStr = code.substring(prefixLen) || '0';
        const suffixNum = parseInt(suffixStr, 10);
        if (!isNaN(suffixNum) && suffixNum > maxSuffix) {
          maxSuffix = suffixNum;
        }
      }
    }
    const next = maxSuffix + 1;
    const suffix = next.toString().padStart(2, '0');
    return `${base}${suffix}`;
  }
}


