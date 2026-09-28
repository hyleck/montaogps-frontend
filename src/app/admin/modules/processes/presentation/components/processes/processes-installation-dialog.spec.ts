import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { ColorsService } from 'src/app/core/services/colors.service';
import { ContactsService } from 'src/app/core/services/contacts.service';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { TagsService } from 'src/app/core/services/tags.service';
import { TargetsService } from 'src/app/core/services/targets.service';
import { UserService } from 'src/app/core/services/user.service';
import { VehicleBrandsService } from 'src/app/core/services/vehicle-brands.service';
import { ProcessesModule } from '../../processes.module';
import { ProcessItem, ProcessesService } from '../../services/processes.service';
import { ProcessesComponent } from './processes.component';

describe('Processes installation dialog', () => {
  const deviceId = '507f1f77bcf86cd799439011';
  let fixture: ComponentFixture<ProcessesComponent>;
  let component: ProcessesComponent;
  let targets: jasmine.SpyObj<TargetsService>;
  const process: ProcessItem = {
    _id: 'process-installation', type: 1, description: 'Instalación de GPS',
    reference: deviceId, target: { _id: deviceId, name: 'Camión', device_imei: '863874080932787' },
    user: { _id: 'client', name: 'Cliente' }, before: {}, after: {}, creator: 'employee',
    registrationDate: '2026-09-28', createdAt: '2026-09-28T13:00:00Z', updatedAt: '2026-09-28T13:00:00Z',
  };

  beforeEach(async () => {
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
        { provide: UserService, useValue: { getTechnicians: () => of([]), getEmployees: () => of([]) } },
        { provide: VehicleBrandsService, useValue: { getAllBrands: () => Promise.resolve([]) } },
        { provide: ColorsService, useValue: { getAllColors: () => Promise.resolve([]) } },
        { provide: ProtocolsService, useValue: { getAllProtocols: () => of([]) } },
        { provide: TargetsService, useValue: targets },
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
    expect(targets.getTargetById).not.toHaveBeenCalled();
    expect(targets.getDeviceRecords).not.toHaveBeenCalled();
  });
});
