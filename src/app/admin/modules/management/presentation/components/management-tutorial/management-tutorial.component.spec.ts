import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../../../../../../core/services/auth.service';
import { environment } from '../../../../../../../environments/environment';
import { ManagementTutorialComponent } from './management-tutorial.component';
import { MANAGEMENT_TUTORIALS, TutorialVideo } from './management-tutorial.data';

type Profile = { affiliation: string; root?: boolean; privileges: string[] };

describe('ManagementTutorialComponent', () => {
  function create(profile: Profile | null, tutorials?: readonly TutorialVideo[]) {
    const granted = new Set(profile?.privileges ?? []);
    TestBed.configureTestingModule({
      imports: [ManagementTutorialComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: () =>
              profile && { affiliation_type_id: profile.affiliation, root: profile.root === true },
            hasPrivilege: (module: string, action: string) => granted.has(`${module}.${action}`),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ManagementTutorialComponent);
    if (tutorials) fixture.componentInstance.tutorials = tutorials;
    return { component: fixture.componentInstance, http: TestBed.inject(HttpTestingController) };
  }
  const ids = (list: readonly TutorialVideo[]) => list.map((t) => t.id).sort();
  const all = (modules: string[]) =>
    modules.flatMap((m) => ['create', 'read', 'update', 'delete'].map((a) => `${m}.${a}`));

  it('a un cliente de solo lectura le muestra solo las guías de consulta', () => {
    const { component } = create({ affiliation: 'cliente', privileges: ['devices.read'] });
    expect(ids(component.list())).toEqual(
      ['accesos-directos', 'buscar-objetivos', 'conoce-gestion-gps', 'filtrar-objetivos', 'ver-objetivo-mapa'],
    );
  });

  it('muestra las guías de objetivos y usuarios según cada privilegio, sin las del personal', () => {
    const { component } = create({
      affiliation: 'cliente',
      privileges: ['devices.read', 'devices.update', 'users.read', 'users.update'],
    });
    const visible = ids(component.list());
    expect(visible).toContain('compartir-dispositivo');
    expect(visible).toContain('editar-usuario');
    expect(visible).not.toContain('crear-usuario');
    expect(visible).not.toContain('eliminar-usuario');
    expect(visible).not.toContain('crear-cuenta-transferir');
    expect(component.list().some((t) => t.requires.employee)).toBeFalse();
  });

  it('un cliente con todos los privilegios ve 17 guías y ninguna del personal', () => {
    const { component } = create({ affiliation: 'cliente', privileges: all(['devices', 'users']) });
    expect(component.list().length).toBe(17);
    expect(component.categories()).not.toContain('Personal de Montao');
  });

  it('al personal le exige también el privilegio de cada acción', () => {
    const full = create({ affiliation: 'empleado', privileges: all(['devices', 'users']) });
    expect(full.component.list().length).toBe(MANAGEMENT_TUTORIALS.length);
    TestBed.resetTestingModule();
    const noCreate = create({
      affiliation: 'empleado',
      privileges: all(['devices', 'users']).filter((p) => p !== 'devices.create'),
    });
    expect(ids(noCreate.component.list())).not.toContain('registrar-objetivo');
    expect(ids(noCreate.component.list())).toContain('activar-gps');
  });

  it('trata a root como personal y oculta todo sin sesión', () => {
    const root = create({ affiliation: 'cliente', root: true, privileges: all(['devices', 'users']) });
    expect(root.component.list().length).toBe(MANAGEMENT_TUTORIALS.length);
    TestBed.resetTestingModule();
    expect(create(null).component.list().length).toBe(0);
  });

  it('filtra por búsqueda sin acentos y por categoría', () => {
    const { component } = create({ affiliation: 'empleado', privileges: all(['devices', 'users']) });
    component.query.set('gps reactivar');
    expect(ids(component.filtered())).toEqual(['activar-gps']);
    component.query.set('');
    component.category.set('Usuarios');
    expect(component.filtered().every((t) => t.category === 'Usuarios')).toBeTrue();
  });

  it('pide la URL de reproducción al backend y solo acepta https', async () => {
    const { component, http } = create({ affiliation: 'cliente', privileges: all(['devices', 'users']) });
    const [first, second] = component.list();
    component.watch(first);
    http.expectOne(`${environment.apiUrl}/tutorials/${first.id}/playback`)
      .flush({ playbackUrl: 'https://files.montao.net/v.mp4' });
    await new Promise((resolve) => setTimeout(resolve));
    expect(component.source()).toBe('https://files.montao.net/v.mp4');
    component.watch(second);
    http.expectOne(`${environment.apiUrl}/tutorials/${second.id}/playback`)
      .flush({ playbackUrl: 'http://files.montao.net/v.mp4' });
    await new Promise((resolve) => setTimeout(resolve));
    expect(component.source()).toBe('');
    expect(component.error()).toContain('No pudimos cargar el video');
    http.verify();
  });
});
