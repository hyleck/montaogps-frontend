import { Component, OnInit } from '@angular/core';
import {
  InstructivoGuide,
  InstructivoPlatform,
  InstructivosService,
} from '../../../../../../core/services/instructivos.service';

type PlatformFilter = 'all' | InstructivoPlatform;

@Component({
  selector: 'app-instructivos',
  templateUrl: './instructivos.component.html',
  styleUrls: ['./instructivos.component.css'],
  standalone: false,
})
export class InstructivosComponent implements OnInit {
  guides: InstructivoGuide[] = [];
  loading = true;
  error = '';
  userType = '';
  search = '';
  platform: PlatformFilter = 'all';
  category = 'all';
  selectedGuideId = '';
  copiedGuideId = '';

  readonly platforms: Array<{
    value: PlatformFilter;
    label: string;
    icon: string;
  }> = [
    { value: 'all', label: 'Todos', icon: 'pi pi-th-large' },
    { value: 'mobile', label: 'App móvil', icon: 'pi pi-mobile' },
    { value: 'desktop', label: 'Escritorio', icon: 'pi pi-desktop' },
  ];

  constructor(private readonly instructivosService: InstructivosService) {}

  ngOnInit(): void {
    this.loadGuides();
  }

  get categories(): string[] {
    return [...new Set(this.guides.map(guide => guide.category))]
      .sort((left, right) => left.localeCompare(right, 'es'));
  }

  get filteredGuides(): InstructivoGuide[] {
    const query = this.normalize(this.search);
    return this.guides.filter(guide => {
      if (this.platform !== 'all' && guide.platform !== this.platform) {
        return false;
      }
      if (this.category !== 'all' && guide.category !== this.category) {
        return false;
      }
      if (!query) return true;
      return this.normalize([
        guide.title,
        guide.category,
        ...guide.steps,
        ...guide.notes,
      ].join(' ')).includes(query);
    });
  }

  get selectedGuide(): InstructivoGuide | null {
    const visible = this.filteredGuides;
    return visible.find(guide => guide.id === this.selectedGuideId)
      || visible[0]
      || null;
  }

  loadGuides(): void {
    this.loading = true;
    this.error = '';
    this.instructivosService.getGuides().subscribe({
      next: response => {
        this.guides = Array.isArray(response?.guides) ? response.guides : [];
        this.userType = String(response?.userType || 'usuario');
        this.selectedGuideId = this.guides[0]?.id || '';
        this.loading = false;
      },
      error: error => {
        this.guides = [];
        this.error = error?.error?.message
          || 'No se pudieron cargar los instructivos en este momento.';
        this.loading = false;
      },
    });
  }

  selectPlatform(platform: PlatformFilter): void {
    this.platform = platform;
    this.ensureVisibleSelection();
  }

  selectCategory(category: string): void {
    this.category = category;
    this.ensureVisibleSelection();
  }

  onSearchChange(): void {
    this.ensureVisibleSelection();
  }

  clearSearch(): void {
    this.search = '';
    this.ensureVisibleSelection();
  }

  selectGuide(guide: InstructivoGuide): void {
    this.selectedGuideId = guide.id;
    this.copiedGuideId = '';
  }

  countByPlatform(platform: PlatformFilter): number {
    return platform === 'all'
      ? this.guides.length
      : this.guides.filter(guide => guide.platform === platform).length;
  }

  countByCategory(category: string): number {
    return this.guides.filter(guide => guide.category === category).length;
  }

  platformLabel(platform: InstructivoPlatform): string {
    return platform === 'mobile' ? 'App móvil' : 'Escritorio';
  }

  platformIcon(platform: InstructivoPlatform): string {
    return platform === 'mobile' ? 'pi pi-mobile' : 'pi pi-desktop';
  }

  async copyGuide(guide: InstructivoGuide): Promise<void> {
    const text = [
      guide.title,
      ...guide.steps.map((step, index) => `${index + 1}. ${step}`),
      ...guide.notes.map(note => `Nota: ${note}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.copiedGuideId = guide.id;
      window.setTimeout(() => {
        if (this.copiedGuideId === guide.id) this.copiedGuideId = '';
      }, 1800);
    } catch {
      this.copiedGuideId = '';
    }
  }

  trackGuide(_index: number, guide: InstructivoGuide): string {
    return guide.id;
  }

  private ensureVisibleSelection(): void {
    const visible = this.filteredGuides;
    if (!visible.some(guide => guide.id === this.selectedGuideId)) {
      this.selectedGuideId = visible[0]?.id || '';
    }
  }

  private normalize(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }
}
