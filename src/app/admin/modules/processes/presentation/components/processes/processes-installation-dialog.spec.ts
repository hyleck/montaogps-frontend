import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { ColorsService } from 'src/app/core/services/colors.service';
import { ContactsService } from 'src/app/core/services/contacts.service';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { SolicitudesService } from 'src/app/core/services/solicitudes.service';
import { TagsService } from 'src/app/core/services/tags.service';
import { TargetsService } from 'src/app/core/services/targets.service';
import { UserService } from 'src/app/core/services/user.service';
import { VehicleBrandsService } from 'src/app/core/services/vehicle-brands.service';
import { ProcessesModule } from '../../processes.module';
import { ProcessItem, ProcessesService } from '../../services/processes.service';
import { ProcessesComponent } from './processes.component';

describe('Processes installation dialog', () => {
  const deviceId = '507f1f77bcf86cd799439011';
  const solicitudId = '507f1f77bcf86cd799439044';
  let fixture: ComponentFixture<ProcessesComponent>;
  let component: ProcessesComponent;
  let targets: jasmine.SpyObj<TargetsService>;
  let solicitudes: jasmine.SpyObj<SolicitudesService>;
  let users: jasmine.SpyObj<UserService>;
  const process: ProcessItem = {
    _id: 'process-installation', type: 1, description: 'Instalación de GPS',
    reference: deviceId, target: { _id: deviceId, name: 'Camión', device_imei: '863874080932787' },
    user: { _id: 'client', name: 'Cliente' }, before: {}, after: {}, creator: 'employee',
    registrationDate: '2026-09-28', createdAt: '2026-09-28T13:00:00Z', updatedAt: '2026-09-28T13:00:00Z',
  };

  beforeEach(async () => {
    users = jasmine.createSpyObj('UserService', ['getTechnicians', 'getEmployees', 'getById', 'getUserPath']);
    users.getTechnicians.and.returnValue(of([]));
    users.getEmployees.and.returnValue(of([]));
    users.getById.and.returnValue(of(null as any));
    users.getUserPath.and.returnValue(of([]));
    solicitudes = jasmine.createSpyObj('SolicitudesService', ['getById']);
    solicitudes.getById.and.returnValue(of(null as any));
    targets = jasmine.createSpyObj('TargetsService', ['getTargetById', 'getDeviceRecords']);
    targets.getTargetById.and.resolveTo({
      _id: deviceId, name: 'Camión Isuzu', device_imei: '863874080932787',
      target_plate_number: 'L123456', target_chassis_number: 'CHASIS-123',
      sim_card_number: 'SIM-001', protocol: { name: 'Modelo GPS' },
      installation_details: 'Equipo instalado debajo del tablero.',
    } as any);
    targets.getDeviceRecords.and.resolveTo({
      deviceId, imei: '863874080932787', entries: [{
        id: 'installation:1', occurredAt: '2026-09-28T13:00:00Z', category: 'installation',
        title: 'Instalación completada', description: 'Instalación verificada.', status: 'success',
        icon: 'pi-check-circle', actor: { name: 'Técnico de instalación' },
        source: { type: 'process', id: process._id },
      }],
    });
    await TestBed.configureTestingModule({
      imports: [ProcessesModule, NoopAnimationsModule, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: ProcessesService, useValue: { getPaginated: () => of({ data: [], total: 0 }) } },
        { provide: UserService, useValue: users },
        { provide: VehicleBrandsService, useValue: { getAllBrands: () => Promise.resolve([]) } },
        { provide: ColorsService, useValue: { getAllColors: () => Promise.resolve([]) } },
        { provide: ProtocolsService, useValue: { getAllProtocols: () => of([]) } },
        { provide: TargetsService, useValue: targets },
        { provide: SolicitudesService, useValue: solicitudes },
        { provide: AuthService, useValue: { getCurrentUser: () => ({ affiliation_type_id: 'empleado' }) } },
        { provide: ContactsService, useValue: { getAll: () => of([{ full_name: 'Contacto del vehículo', phone: '8095550100', relationship: 'Propietario', reference: deviceId }]) } },
        { provide: TagsService, useValue: { getAllTags: () => of([]), getTagById: () => of(null) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProcessesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the vehicle and GPS and opens the shared record history in the same dialog', async () => {
    component.showDetail(process);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialog: HTMLElement = fixture.nativeElement.querySelector('.process-detail-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('Camión Isuzu');
    expect(dialog.textContent).toContain('L123456');
    expect(dialog.textContent).toContain('CHASIS-123');
    expect(dialog.textContent).toContain('SIM-001');
    expect(dialog.textContent).toContain('Equipo instalado debajo del tablero.');
    expect(dialog.textContent).toContain('Contacto del vehículo');

    const history = dialog.querySelector<HTMLButtonElement>('button[aria-controls="installation-device-records"]')!;
    expect(history.disabled).toBeFalse();
    history.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(targets.getDeviceRecords).toHaveBeenCalledOnceWith(deviceId);
    expect(dialog.querySelector('app-device-records')?.textContent).toContain('Instalación completada');
    expect(dialog.querySelector('app-device-records')?.textContent).toContain('Técnico de instalación');
    expect(component.detailDialogVisible).toBeTrue();
    history.click();
    fixture.detectChanges();
    expect(dialog.querySelector('app-device-records')).toBeNull();
    expect(component.detailDialogVisible).toBeTrue();
  });

  it('does not add installation fields or history to other process types', async () => {
    component.showDetail({ ...process, type: 4 });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.installation-detail')).toBeNull();
    expect(fixture.nativeElement.querySelector('.installation-stepper')).toBeNull();
    expect(targets.getTargetById).not.toHaveBeenCalled();
    expect(targets.getDeviceRecords).not.toHaveBeenCalled();
    expect(solicitudes.getById).not.toHaveBeenCalled();
  });

  [1, 18].forEach(type => {
    it(`shows the ten progress steps before the installation details for process type ${type}`, async () => {
      solicitudes.getById.and.returnValue(of({
        _id: solicitudId, type: 'instalacion', status: 'in_progress', installations: [{
          _id: 'installation-row', device_imei: '863874080932787', registered_device_id: deviceId,
          process_type: type === 18 ? 'reinstalacion' : 'instalacion',
        }],
      }));
      component.showDetail({
        ...process, type,
        target: { ...process.target, solicitud_id: solicitudId, solicitud_installation_index: 0 },
      });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const detail: HTMLElement = fixture.nativeElement.querySelector('.process-detail');
      const stepper = detail.querySelector('.installation-stepper');
      expect(stepper).not.toBeNull();
      expect(detail.firstElementChild).toBe(stepper);
      expect(Array.from(stepper!.querySelectorAll('button[data-step-id]')).map(button => button.getAttribute('data-step-id')))
        .toEqual(['inicio', 'tecnico', 'vehiculo', 'gps', 'fotos-antes', 'instalacion', 'fotos-despues', 'conexion', 'cierre', 'revision']);
      expect(solicitudes.getById).toHaveBeenCalledOnceWith(solicitudId);
      expect(detail.querySelector('.installation-detail')?.textContent).toContain('Vehículo y GPS');
    });
  });

  it('opens the chosen step and distinguishes its recorded and missing photo checks', async () => {
    solicitudes.getById.and.returnValue(of({
      _id: solicitudId, type: 'instalacion', status: 'in_progress', installations: [{
        _id: 'installation-row', device_imei: '863874080932787', registered_device_id: deviceId,
        installation_evidence: [{ field: 'chasis_img', url: 'https://images.example/chassis.jpg' }],
      }],
    }));
    component.showDetail({
      ...process,
      target: { ...process.target, solicitud_id: solicitudId, solicitud_installation_index: 0 },
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const photos: HTMLButtonElement = fixture.nativeElement.querySelector('button[data-step-id="fotos-antes"]');
    photos.click();
    fixture.detectChanges();

    const checks: HTMLElement = fixture.nativeElement.querySelector('#installation-progress-checks');
    expect(photos.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('.installation-stepper button[aria-expanded="true"]').length).toBe(1);
    expect(checks.querySelector('h4')?.textContent).toBe('Fotos antes');
    const items = Array.from(checks.querySelectorAll('li'));
    const chassis = items.find(item => item.textContent?.includes('Foto del chasis'))!;
    const plate = items.find(item => item.textContent?.includes('Foto de la placa'))!;
    expect(chassis.textContent).toContain('Registrada');
    expect(chassis.textContent).toContain('Completo');
    expect(plate.textContent).toContain('Pendiente');
    expect(plate.textContent).not.toContain('Registrada');
    const photo = checks.querySelector<HTMLAnchorElement>('a[href="https://images.example/chassis.jpg"]');
    expect(photo).not.toBeNull();
    expect(photo?.querySelector('img')?.getAttribute('src')).toBe('https://images.example/chassis.jpg');
    expect(component.detailDialogVisible).toBeTrue();
  });

  it('shows the saved details and evidence as each stage is selected from start through review', async () => {
    const technicianId = '507f1f77bcf86cd799439066';
    component.techniciansMap = { [technicianId]: 'Rafael Gómez' };
    solicitudes.getById.and.returnValue(of({
      _id: solicitudId, type: 'instalacion', status: 'completed', createdAt: '2026-09-28T12:00:00Z',
      created_by_name: 'Operadora de solicitud', client_name: 'Cliente de la solicitud',
      mechanic_id: technicianId, technician_response: 'aceptada', scheduled_date: '2026-09-28T13:00:00Z',
      installations: [{
        _id: 'installation-row', device_imei: '863874080932787', registered_device_id: deviceId,
        target_name: 'Furgón de la solicitud', brand: 'Isuzu', model: 'NPR', year: '2025',
        color: 'Blanco', plate: 'SOL-123', chassis: 'CHASIS-SOLICITUD',
        sim_card_number: 'SIM-PROCESO', sim_company: 'Claro', new_protocol: 'GT06',
        installation_location: 'Bajo el volante', installation_details: 'Cableado protegido en el tablero.',
        engine_shutdown: 'yes', ignition_sensor: 'yes',
        installation_evidence: [
          { field: 'chasis_img', url: 'https://images.example/chassis.jpg', uploaded_at: '2026-09-28T13:10:00Z' },
          { field: 'lugar_instalacion_despues_img', url: 'https://images.example/installed.jpg', uploaded_at: '2026-09-28T13:50:00Z' },
        ],
        final_device_online: true, final_device_status: 'En línea', final_device_status_at: '2026-09-28T13:55:00Z',
        completed: true, completion_source: 'technician', completed_at: '2026-09-28T14:00:00Z',
        completed_by_name: 'Rafael Gómez',
      }],
    }));
    component.showDetail({
      ...process, target: { ...process.target, solicitud_id: solicitudId, solicitud_installation_index: 0 },
      verificationStatus: 'verified', verifiedBy: { name: 'Supervisora de revisión' },
      verifiedAt: '2026-09-28T15:00:00Z', verificationNote: 'Documentación revisada.',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const expectedStages = [
      { id: 'inicio', value: 'Operadora de solicitud' },
      { id: 'tecnico', value: 'Rafael Gómez' },
      { id: 'vehiculo', value: 'Furgón de la solicitud' },
      { id: 'gps', value: 'SIM-PROCESO' },
      { id: 'fotos-antes', value: 'Foto del chasis', photo: 'https://images.example/chassis.jpg' },
      { id: 'instalacion', value: 'Bajo el volante' },
      { id: 'fotos-despues', value: 'Lugar después de instalar', photo: 'https://images.example/installed.jpg' },
      { id: 'conexion', value: 'En línea' },
      { id: 'cierre', value: 'Rafael Gómez' },
      { id: 'revision', value: 'Documentación revisada.' },
    ];
    for (const stage of expectedStages) {
      const button: HTMLButtonElement = fixture.nativeElement.querySelector(`button[data-step-id="${stage.id}"]`);
      button.click();
      fixture.detectChanges();
      const panel: HTMLElement = fixture.nativeElement.querySelector('#installation-progress-checks');
      expect(button.getAttribute('aria-expanded')).withContext(stage.id).toBe('true');
      expect(panel.textContent).withContext(stage.id).toContain(stage.value);
      expect(panel.querySelectorAll('li').length).withContext(stage.id).toBeGreaterThan(0);
      if (stage.photo) {
        const photo = panel.querySelector<HTMLAnchorElement>(`a[href="${stage.photo}"]`);
        expect(photo).withContext(stage.id).not.toBeNull();
        expect(photo?.querySelector('img')?.getAttribute('src')).withContext(stage.id).toBe(stage.photo);
      }
    }
  });

  it('shows the current parent client, subclient and the technician who completed the installation', async () => {
    const clientId = '507f1f77bcf86cd799439055';
    const subclientId = '507f1f77bcf86cd799439077';
    targets.getTargetById.and.resolveTo({ _id: deviceId, device_imei: '863874080932787', parent_id: subclientId } as any);
    users.getUserPath.and.returnValue(of([
      { id: clientId, fullName: 'Transportes del Caribe', affiliation_type_id: 'cliente' },
      { id: subclientId, fullName: 'Sucursal Santiago', affiliation_type_id: 'subcliente' },
    ]));
    solicitudes.getById.and.returnValue(of({
      _id: solicitudId, type: 'instalacion', status: 'completed', client_name: 'Cliente al solicitar',
      mechanic_id: '507f1f77bcf86cd799439088', installations: [{
        device_imei: '863874080932787', completed: true, completion_source: 'technician',
        completed_by_name: 'Rafael Gómez', completed_by_id: '507f1f77bcf86cd799439066',
      }],
    }));
    component.showDetail({ ...process, target: { ...process.target, solicitud_id: solicitudId, solicitud_installation_index: 0 } });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const people: HTMLElement = fixture.nativeElement.querySelector('.installation-people');
    expect(people.querySelector('[data-person-role="client"]')?.textContent).toContain('Transportes del Caribe');
    expect(people.querySelector('[data-person-role="subclient"]')?.textContent).toContain('Sucursal Santiago');
    expect(people.querySelector('[data-person-role="technician"]')?.textContent).toContain('Rafael Gómez');
    expect(people.textContent).not.toContain('Cliente al solicitar');
    expect(users.getUserPath).toHaveBeenCalledOnceWith(subclientId);
  });

  it('keeps an unavailable current owner explicit without presenting the process client as its owner', async () => {
    targets.getTargetById.and.resolveTo({ _id: deviceId, parent_id: '507f1f77bcf86cd799439055' } as any);
    users.getUserPath.and.returnValue(throwError(() => ({ status: 403 })));
    component.showDetail({ ...process, client: { name: 'Cliente del proceso' } });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const people: HTMLElement = fixture.nativeElement.querySelector('.installation-people');
    expect(people.querySelector('[data-person-role="client"]')?.textContent).toContain('No disponible');
    expect(people.querySelector('[data-person-role="subclient"]')).toBeNull();
    expect(people.textContent).not.toContain('Cliente del proceso');
  });
});
