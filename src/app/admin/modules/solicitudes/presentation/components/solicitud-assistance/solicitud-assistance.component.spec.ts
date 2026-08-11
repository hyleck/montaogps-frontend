import { of } from 'rxjs';
import { Solicitud } from '../../../../../../core/services/solicitudes.service';
import { SolicitudAssistanceComponent } from './solicitud-assistance.component';

describe('SolicitudAssistanceComponent', () => {
  function createComponent(solicitud: Solicitud): SolicitudAssistanceComponent {
    const solicitudesService = {
      getById: jasmine.createSpy('getById').and.returnValue(of(solicitud)),
      getInstallationDeviceDetails: jasmine.createSpy('getInstallationDeviceDetails').and.returnValue(of({
        device: null,
        imei: null,
      })),
      getTechnicianAssistancePresence: jasmine.createSpy('getTechnicianAssistancePresence').and.returnValue(of({
        online: false,
        presence: null,
        refresh_pending: false,
      })),
      requestTechnicianDataRefresh: jasmine.createSpy('requestTechnicianDataRefresh').and.returnValue(of({
        queued: true,
        command_id: 'refresh-1',
        href: '/instalaciones?refresh=refresh-1',
        technician_online: true,
      })),
      requestTechnicianLogout: jasmine.createSpy('requestTechnicianLogout').and.returnValue(of({
        queued: true,
        action: 'logout',
        command_id: 'logout-1',
        href: '/',
        technician_online: true,
      })),
    };
    const commandsService = {
      getCommandsByDevice: jasmine.createSpy('getCommandsByDevice').and.resolveTo([]),
    };
    const component = new SolicitudAssistanceComponent(
      solicitudesService as any,
      commandsService as any,
      {} as any,
      {} as any,
      { getCurrentUser: () => ({ id: 'employee-1' }) } as any,
      { add: jasmine.createSpy('add') } as any,
      {
        getAllBrands: jasmine.createSpy('getAllBrands').and.resolveTo([]),
        getAllModelsByBrand: jasmine.createSpy('getAllModelsByBrand').and.resolveTo([]),
      } as any,
      { getAllColors: jasmine.createSpy('getAllColors').and.resolveTo([]) } as any,
    );
    component.workingSolicitud = solicitud;
    return component;
  }

  it('shows the recovery actions saved by GPS Mobile for a checkup', () => {
    const component = createComponent({
      _id: 'checkup-request',
      type: 'chequeo',
      status: 'en_progreso',
      installations: [{
        device_imei: '868720064472750',
        diagnosis: 'Se corrigió el cable de alimentación.',
        checkup_recovery: {
          connection_checked: true,
          connection_corrected: true,
          power_checked: true,
          online_confirmed: true,
        },
      }],
    });

    const actions = component.actions;

    expect(actions.map(action => action.id)).toContain('connection');
    expect(actions.map(action => action.id)).toContain('power');
    expect(actions.map(action => action.id)).toContain('sim');
    expect(actions.map(action => action.id)).toContain('gps');
    expect(actions.find(action => action.id === 'connection')?.state).toBe('done');
    expect(actions.find(action => action.id === 'online')?.state).toBe('done');
    expect(actions.find(action => action.id === 'diagnosis')?.state).toBe('done');
  });

  it('shows an automatically skipped process as omitted and read-only', () => {
    const component = createComponent({
      _id: 'omitted-request',
      type: 'instalacion',
      status: 'por_confirmar',
      installations: [{
        omitted: true,
        omitted_reason: 'La solicitud finalizó antes de completar este proceso.',
        completed: false,
        cancelled: false,
      }],
    });

    expect(component.getProcessStatus(component.installation!)).toEqual({
      label: 'Omitido',
      state: 'omitted',
    });
    expect(component.canEditProcess).toBeFalse();
  });

  it('does not execute assistance actions for a locked request', async () => {
    const component = createComponent({
      _id: 'locked-request',
      type: 'instalacion',
      status: 'en_progreso',
      mechanic_id: 'technician-1',
      locked: true,
      installations: [{}],
    });

    component.openAction(component.actions[0]);
    await component.requestTechnicianDataRefresh();
    await component.requestTechnicianLogout();

    expect(component.canEditProcess).toBeFalse();
    expect(component.activeActionId).toBe('');
    expect(
      (component as any).solicitudesService.requestTechnicianDataRefresh,
    ).not.toHaveBeenCalled();
    expect(
      (component as any).solicitudesService.requestTechnicianLogout,
    ).not.toHaveBeenCalled();
  });

  it('queues the remote technician logout from assistance', async () => {
    const component = createComponent({
      _id: 'logout-request',
      type: 'instalacion',
      status: 'en_progreso',
      mechanic_id: 'technician-1',
      installations: [{}],
    });

    await component.requestTechnicianLogout();

    expect(
      (component as any).solicitudesService.requestTechnicianLogout,
    ).toHaveBeenCalledOnceWith('logout-request');
  });

  it('marks the photo, engine command and fixed-location actions as not applicable for MTAG-P', () => {
    const component = createComponent({
      _id: 'mtag-request',
      type: 'instalacion',
      status: 'en_progreso',
      installations: [{
        device_type: 'mtag_p',
        device_imei: 'MTAG-P-001',
        target_name: 'Maleta principal',
        target_category: 'luggage',
      }],
    });

    const actions = component.actions;

    expect(actions.find(action => action.id === 'before-evidence')?.state).toBe('not_applicable');
    expect(actions.find(action => action.id === 'shutdown')?.state).toBe('not_applicable');
    expect(actions.find(action => action.id === 'location')?.state).toBe('not_applicable');
    expect(actions.find(action => action.id === 'after-evidence')?.state).toBe('not_applicable');
  });

  it('groups shutdown and enable commands in the same vehicle test action', () => {
    const component = createComponent({
      _id: 'installation-request',
      type: 'instalacion',
      status: 'en_progreso',
      installations: [{ device_type: 'gps', device_imei: '868720064472750' }],
    });

    const actions = component.actions;
    const commandAction = actions.find(action => action.id === 'shutdown');

    expect(actions.some(action => action.id === 'enable')).toBeFalse();
    expect(commandAction?.details?.map(detail => detail.label)).toEqual([
      'Comando Apagar Vehículo',
      'Comando Permitir Encendido',
    ]);
  });

  it('opens the operational inventory when the device action is clicked', () => {
    const component = createComponent({
      _id: 'installation-request',
      type: 'instalacion',
      status: 'en_progreso',
      installations: [{}],
    });
    spyOn(component, 'searchInventory').and.resolveTo();

    component.openAction({
      id: 'device',
      title: 'Seleccionar dispositivo',
      description: '',
      icon: 'pi-microchip',
      state: 'pending',
    } as any);

    expect(component.activeActionId).toBe('device');
    expect(component.activeAction?.id).toBe('device');
    expect(component.searchInventory).toHaveBeenCalled();

    component.backToActions();

    expect(component.activeActionId).toBe('');
    expect(component.activeAction).toBeNull();
  });

  it('only shows the process selector when the request has multiple processes', () => {
    const singleProcess = createComponent({
      _id: 'single-process',
      type: 'instalacion',
      status: 'en_progreso',
      installations: [{}],
    });
    const multipleProcesses = createComponent({
      _id: 'multiple-processes',
      type: 'instalacion',
      status: 'en_progreso',
      installations: [{}, {}],
    });

    expect(singleProcess.hasMultipleProcesses).toBeFalse();
    expect(multipleProcesses.hasMultipleProcesses).toBeTrue();
  });

  it('only asks for cancellation confirmation after cancellation is initiated', () => {
    const component = createComponent({
      _id: 'installation-request',
      type: 'instalacion',
      status: 'en_progreso',
      installations: [{}],
    });

    expect(component.cancellationMode).toBeFalse();
    expect(component.confirmCancellation).toBeFalse();

    component.beginCancellation();

    expect(component.cancellationMode).toBeTrue();
    expect(component.confirmCancellation).toBeFalse();

    component.confirmCancellation = true;
    component.dismissCancellation();

    expect(component.cancellationMode).toBeFalse();
    expect(component.confirmCancellation).toBeFalse();
  });

  it('marks only the exact action and process where the technician is present', () => {
    const component = createComponent({
      _id: 'installation-request',
      type: 'instalacion',
      status: 'en_progreso',
      installations: [{}, {}],
    });
    component.technicianPresenceState = {
      online: true,
      refresh_pending: false,
      presence: {
        mechanic_id: 'technician-1',
        technician_name: 'María Pérez',
        installation_index: 1,
        action_id: 'activation',
        action_label: 'Activar y comprobar el dispositivo',
        last_seen_at: new Date(),
      },
    };

    component.selectedIndex = 0;
    expect(component.isTechnicianHere('activation')).toBeFalse();

    component.selectedIndex = 1;
    expect(component.isTechnicianHere('details')).toBeFalse();
    expect(component.isTechnicianHere('activation')).toBeTrue();
    expect(component.technicianHereName).toBe('María Pérez');
  });

  it('uses brand, model and color catalog values like the target form', async () => {
    const component = createComponent({
      _id: 'installation-request',
      type: 'instalacion',
      status: 'en_progreso',
      installations: [{
        device_imei: '868720064472750',
        brand: 'Toyota',
        model: 'Corolla',
        color: 'Blanco',
        sim_company: 'Global-E',
      }],
    });
    const brandsService = (component as any).vehicleBrandsService;
    const colorsService = (component as any).colorsService;
    brandsService.getAllBrands.and.resolveTo([{ _id: 'brand-id', nombre: 'Toyota' }]);
    brandsService.getAllModelsByBrand.and.resolveTo([{ _id: 'model-id', nombre: 'Corolla' }]);
    colorsService.getAllColors.and.resolveTo([{ hex: '#ffffff', nombre: 'Blanco' }]);
    (component as any).syncForms();

    await (component as any).ensureVehicleCatalogs();

    expect(component.detailsForm['brand']).toBe('brand-id');
    expect(component.detailsForm['model']).toBe('model-id');
    expect(component.detailsForm['color']).toBe('#ffffff');
    expect(component.detailsForm['sim_company']).toBe('global-e');
    expect(component.vehicleBrands).toEqual([{ label: 'Toyota', value: 'brand-id' }]);
    expect(component.vehicleModels).toEqual([{ label: 'Corolla', value: 'model-id' }]);
  });
});
