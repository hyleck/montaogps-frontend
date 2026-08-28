import { of } from 'rxjs';
import { User } from '../../../../../../core/interfaces';
import { UserService } from '../../../../../../core/services/user.service';
import { EmpleadosComponent } from './empleados.component';

describe('EmpleadosComponent employee list', () => {
  let component: EmpleadosComponent;
  let userService: jasmine.SpyObj<UserService>;

  const employee = (
    id: string,
    status: boolean | undefined = true,
    affiliation = 'empleado',
  ): User => ({
    _id: id,
    name: id,
    last_name: 'Prueba',
    email: `${id}@example.com`,
    status,
    affiliation_type_id: affiliation,
  } as User);

  beforeEach(() => {
    userService = jasmine.createSpyObj<UserService>('UserService', ['getEmployees']);
    component = new EmpleadosComponent(
      userService,
      jasmine.createSpyObj('MessageService', ['add']),
      jasmine.createSpyObj('ProcessService', ['getStatsByCreator']),
      jasmine.createSpyObj('EmployeeMonitoringService', ['getOverview']),
      jasmine.createSpyObj('UserActivityService', ['getUserActivity']),
      jasmine.createSpyObj('UserConsoleLogService', ['getLogs']),
    );
  });

  it('excludes suspended employees and technicians before rendering cards', () => {
    const affiliations = ['empleado', 'tecnico', 'tecnico_empleado', 'tecnico_independiente'];
    const active = affiliations.map((affiliation) => employee(`active-${affiliation}`, true, affiliation));
    const suspended = affiliations.map((affiliation) => employee(`suspended-${affiliation}`, false, affiliation));
    userService.getEmployees.and.returnValue(of([...suspended, ...active]));

    component.loadEmpleados();

    expect(component.empleados).toEqual(active);
    expect(component.paginatedEmpleados).toEqual(active);
    expect(component.loading).toBeFalse();
  });

  it('does not count suspended users even when their monitoring presence is still online', () => {
    userService.getEmployees.and.returnValue(of([
      employee('active'),
      employee('suspended', false),
    ]));
    spyOn(component, 'isEmployeeOnline').and.returnValue(true);
    spyOn(component, 'getMonitoringStatus').and.returnValue({ events_last_hour: 10 } as any);

    component.loadEmpleados();

    expect(component.empleados.length).toBe(1);
    expect(component.onlineEmployees).toBe(1);
    expect(component.employeesWithRecentActivity).toBe(1);
  });

  it('does not include suspended users in search results', () => {
    userService.getEmployees.and.returnValue(of([
      employee('active'),
      employee('suspended', false),
    ]));

    component.loadEmpleados();
    component.searchTerm = 'suspended';

    expect(component.filteredEmpleados).toEqual([]);
    expect(component.paginatedEmpleados).toEqual([]);
  });

  it('keeps active employees visible when they are offline', () => {
    const offlineEmployee = employee('offline');
    userService.getEmployees.and.returnValue(of([offlineEmployee]));

    component.loadEmpleados();

    expect(component.isEmployeeOnline(offlineEmployee)).toBeFalse();
    expect(component.empleados).toEqual([offlineEmployee]);
  });

  it('preserves legacy users without an explicit suspension status', () => {
    const legacyEmployee = employee('legacy');
    delete legacyEmployee.status;
    userService.getEmployees.and.returnValue(of([legacyEmployee]));

    component.loadEmpleados();

    expect(component.empleados).toEqual([legacyEmployee]);
  });

  it('resets pagination when a refresh removes newly suspended users', () => {
    const active = employee('active');
    userService.getEmployees.and.returnValues(
      of([active, employee('suspended')]),
      of([active, employee('suspended', false)]),
    );
    component.loadEmpleados();
    component.employeePageFirst = 12;

    component.loadEmpleados();

    expect(component.employeePageFirst).toBe(0);
    expect(component.paginatedEmpleados).toEqual([active]);
  });
});
