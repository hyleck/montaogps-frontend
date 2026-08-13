import { of, throwError } from 'rxjs';
import { InstructivosComponent } from './instructivos.component';

describe('InstructivosComponent', () => {
  const guides = [
    {
      id: 'map-mobile',
      title: 'Ver un vehículo en el mapa',
      platform: 'mobile' as const,
      category: 'Vehículos y monitoreo',
      steps: ['Abre el menú.', 'Entra en Mapa.'],
      notes: [],
    },
    {
      id: 'inventory-desktop',
      title: 'Consultar inventario',
      platform: 'desktop' as const,
      category: 'Inventario',
      steps: ['Entra en Inventario.'],
      notes: ['Necesitas permiso de lectura.'],
    },
  ];

  it('loads the permission-aware documentation and selects the first guide', () => {
    const service = {
      getGuides: jasmine.createSpy('getGuides').and.returnValue(of({
        userType: 'empleado con rol Operaciones',
        guides,
      })),
    };
    const component = new InstructivosComponent(service as any);

    component.ngOnInit();

    expect(component.loading).toBeFalse();
    expect(component.userType).toBe('empleado con rol Operaciones');
    expect(component.guides.length).toBe(2);
    expect(component.selectedGuide?.id).toBe('map-mobile');
  });

  it('filters by platform, category and searchable step content', () => {
    const component = new InstructivosComponent({ getGuides: () => of({ userType: 'empleado', guides }) } as any);
    component.ngOnInit();

    component.selectPlatform('desktop');
    expect(component.filteredGuides.map(guide => guide.id)).toEqual(['inventory-desktop']);

    component.selectPlatform('all');
    component.selectCategory('Vehículos y monitoreo');
    component.search = 'entra en mapa';
    component.onSearchChange();

    expect(component.filteredGuides.map(guide => guide.id)).toEqual(['map-mobile']);
  });

  it('shows a useful error when the catalog cannot be loaded', () => {
    const service = {
      getGuides: jasmine.createSpy('getGuides').and.returnValue(
        throwError(() => ({ error: { message: 'Documentación no disponible' } })),
      ),
    };
    const component = new InstructivosComponent(service as any);

    component.loadGuides();

    expect(component.loading).toBeFalse();
    expect(component.error).toBe('Documentación no disponible');
    expect(component.guides).toEqual([]);
  });
});
