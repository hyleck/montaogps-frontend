/// <reference types="google.maps" />

import { of } from 'rxjs';
import { DEVICE_CANCELLATION_REASONS } from '../../../../../../core/constants/device-cancellation-reasons.constant';
import { Solicitud } from '../../../../../../core/services/solicitudes.service';
import { SolicitudesComponent } from './solicitudes.component';

describe('SolicitudesComponent scheduled date editing', () => {
    function createComponent() {
        const solicitudesService = {
            create: jasmine.createSpy('create').and.returnValue(of({})),
            update: jasmine.createSpy('update').and.returnValue(of({})),
        };
        const messageService = {
            add: jasmine.createSpy('add'),
        };
        const component = new SolicitudesComponent(
            solicitudesService as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            messageService as any,
            {} as any,
            {} as any,
            {} as any,
        );
        spyOn(component, 'initRootLocationMap');
        spyOn(component, 'openInstallationModal');
        spyOn(component, 'loadSolicitudes');

        return { component, solicitudesService };
    }

    it('keeps an existing unscheduled request empty when opened and saved unchanged', async () => {
        const { component, solicitudesService } = createComponent();
        const solicitud: Solicitud = {
            _id: 'request-id',
            type: 'instalacion',
            status: 'pendiente',
            scheduled_date: '',
            installations: [{}],
        };

        await component.editSolicitud(solicitud);

        expect(component.selectedSolicitud?.scheduled_date).toBe('');

        await component.saveSolicitud();

        const savedSolicitud = solicitudesService.update.calls.mostRecent().args[1] as Solicitud;
        expect(savedSolicitud.scheduled_date).toBe('');
        expect(savedSolicitud.installations?.[0]?.scheduled_date).toBeUndefined();
    });

    it('still defaults a newly created request to the current local date and time', async () => {
        const { component } = createComponent();

        await component.openNew();

        expect(component.selectedSolicitud?.scheduled_date).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
        );
    });

    it('uses the same cancellation reason catalog and blocks a deinstallation without a reason', async () => {
        const { component, solicitudesService } = createComponent();
        component.selectedSolicitud = {
            type: 'desinstalacion',
            status: 'pendiente',
            quantity: 1,
            installations: [{ device_imei: '111111111111111' }],
        };

        await component.saveSolicitud();

        expect(component.deinstallationReasons).toBe(DEVICE_CANCELLATION_REASONS);
        expect(component.deinstallationReasonError).toBeTrue();
        expect(component.completionConfirmDialogVisible).toBeFalse();
        expect(solicitudesService.create).not.toHaveBeenCalled();
    });

    it('creates a deinstallation after a valid reason is selected', async () => {
        const { component, solicitudesService } = createComponent();
        component.selectedSolicitud = {
            type: 'desinstalacion',
            status: 'pendiente',
            quantity: 1,
            deinstallation_reason: 'vehicle_sold',
            installations: [{ device_imei: '111111111111111' }],
        };

        await component.saveSolicitud();

        expect(component.deinstallationReasonError).toBeFalse();
        expect(solicitudesService.create).toHaveBeenCalled();
        const payload = solicitudesService.create.calls.mostRecent().args[0] as Solicitud;
        expect(payload.deinstallation_reason).toBe('vehicle_sold');
    });

    it('clears the reason when changing away from deinstallation', () => {
        const { component } = createComponent();
        component.selectedSolicitud = {
            type: 'instalacion',
            status: 'pendiente',
            quantity: 1,
            deinstallation_reason: 'vehicle_sold',
            installations: [{}],
        };

        component.onTypeChange();

        expect(component.selectedSolicitud.deinstallation_reason).toBeUndefined();
    });

    it('composes the irreversible completion modal with the deinstallation reason label', async () => {
        const { component, solicitudesService } = createComponent();
        component.selectedSolicitud = {
            type: 'desinstalacion',
            status: 'completada',
            quantity: 1,
            client_name: 'Cliente prueba',
            deinstallation_reason: 'device_damaged',
            installations: [{ device_imei: '111111111111111' }],
        };

        await component.saveSolicitud();

        expect(component.completionConfirmDialogVisible).toBeTrue();
        expect(component.completionSolicitud).toBe(component.selectedSolicitud);
        expect(component.completionDeinstallationReasonLabel).toBe('Dispositivo dañado');
        expect(solicitudesService.create).not.toHaveBeenCalled();
    });

    it('does not compose deinstallation impact data for other request types', async () => {
        const { component } = createComponent();
        component.selectedSolicitud = {
            type: 'chequeo',
            status: 'completada',
            quantity: 1,
            installations: [{ device_imei: '111111111111111' }],
        };

        await component.saveSolicitud();

        expect(component.completionConfirmDialogVisible).toBeTrue();
        expect(component.completionDeinstallationReasonLabel).toBe('');
    });

    it('blocks any centralized completion path when a legacy deinstallation has no reason', () => {
        const { component } = createComponent();
        const action = jasmine.createSpy('completionAction');

        (component as any).confirmSolicitudCompletion(
            {
                type: 'desinstalacion',
                status: 'en_progreso',
                installations: [{ device_imei: '111111111111111' }],
            },
            action,
        );

        expect(component.completionConfirmDialogVisible).toBeFalse();
        expect(component.completionSolicitud).toBeNull();
        expect(action).not.toHaveBeenCalled();
    });

    it('filters every Kanban column and its counters by technician, client and type', () => {
        const { component, solicitudesService } = createComponent();
        component.availableTechnicians = [
            { _id: 'tech-1', name: 'Ana', last_name: 'Pérez' },
            { _id: 'tech-2', name: 'Luis', last_name: 'Díaz' },
        ];
        component.solicitudes = [
            {
                _id: 'request-1',
                type: 'instalacion',
                status: 'pendiente',
                mechanic_id: 'tech-1',
                client_name: 'Cliente Alfa',
                scheduled_date: '2026-07-10T09:00',
            },
            {
                _id: 'request-2',
                type: 'desinstalacion',
                status: 'en_progreso',
                mechanic_id: 'tech-2',
                client_name: 'Cliente Beta',
                scheduled_date: '2026-07-20T09:00',
            },
            {
                _id: 'request-3',
                type: 'chequeo',
                status: 'completada',
                client_name: 'Cliente Gamma',
            },
            {
                _id: 'request-4',
                type: 'instalacion',
                status: 'por_confirmar',
                mechanic_id: 'tech-1',
                client_name: 'Cliente Alfa',
                scheduled_date: '2026-07-31T09:00',
            },
        ];

        component.topFilterTechnician = 'tech-1';
        component.topFilterType = 'instalacion';
        component.topFilterClient = component.topFilterClientOptions
            .find(option => option.label === 'Cliente Alfa')!.value;

        expect(component.pendientes.map(item => item._id)).toEqual(['request-1']);
        expect(component.enProgreso).toEqual([]);
        expect(component.porConfirmar.map(item => item._id)).toEqual(['request-4']);
        expect(component.completadas).toEqual([]);
        expect(component.countByStatus('pendiente')).toBe(1);
        expect(component.countByStatus('completada')).toBe(0);
        expect(solicitudesService.update).not.toHaveBeenCalled();
        expect(solicitudesService.create).not.toHaveBeenCalled();
    });

    it('applies an inclusive scheduled-date range using the first installation fallback', () => {
        const { component } = createComponent();
        component.solicitudes = [
            {
                _id: 'request-from',
                type: 'instalacion',
                status: 'pendiente',
                scheduled_date: '2026-07-10T08:00',
            },
            {
                _id: 'request-to',
                type: 'chequeo',
                status: 'en_progreso',
                installations: [{ scheduled_date: '2026-07-20T18:00' }],
            },
            {
                _id: 'request-after',
                type: 'cambio',
                status: 'por_confirmar',
                scheduled_date: '2026-07-21T08:00',
            },
            {
                _id: 'request-unscheduled',
                type: 'desinstalacion',
                status: 'pendiente',
            },
        ];
        component.topFilterDateFrom = '2026-07-10';
        component.topFilterDateTo = '2026-07-20';

        expect(component.filteredSolicitudes.map(item => item._id)).toEqual([
            'request-from',
            'request-to',
        ]);
    });

    it('does not hide requests for an invalid date range and clears all filters locally', () => {
        const { component, solicitudesService } = createComponent();
        component.solicitudes = [
            { _id: 'request-1', type: 'instalacion', status: 'pendiente' },
            { _id: 'request-2', type: 'chequeo', status: 'completada', scheduled_date: '2026-07-20T09:00' },
        ];
        component.topFilterTechnician = '__unassigned__';
        component.topFilterClient = '__unidentified__';
        component.topFilterType = 'instalacion';
        component.topFilterDateFrom = '2026-07-25';
        component.topFilterDateTo = '2026-07-20';

        expect(component.hasInvalidTopFilterDateRange).toBeTrue();
        expect(component.filteredSolicitudes.map(item => item._id)).toEqual(['request-1']);

        component.clearTopFilters();

        expect(component.hasInvalidTopFilterDateRange).toBeFalse();
        expect(component.activeTopFilterCount).toBe(0);
        expect(component.filteredSolicitudes.length).toBe(2);
        expect(solicitudesService.update).not.toHaveBeenCalled();
        expect(solicitudesService.create).not.toHaveBeenCalled();
    });
});
