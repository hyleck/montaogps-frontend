/// <reference types="google.maps" />

import { of, Subject } from 'rxjs';
import { DEVICE_CANCELLATION_REASONS } from '../../../../../../core/constants/device-cancellation-reasons.constant';
import { Solicitud } from '../../../../../../core/services/solicitudes.service';
import { SolicitudesComponent } from './solicitudes.component';

describe('SolicitudesComponent scheduled date editing', () => {
    function createComponent() {
        const solicitudesService = {
            getAll: jasmine.createSpy('getAll').and.returnValue(of({ data: [], total: 0 })),
            checkTechnicianScheduleConflict: jasmine.createSpy('checkTechnicianScheduleConflict')
                .and.returnValue(of({ available: true })),
            getTechnicianRecommendation: jasmine.createSpy('getTechnicianRecommendation')
                .and.returnValue(of({
                    recommendation: null,
                    evaluated_technicians: 0,
                    available_technicians: 0,
                })),
            create: jasmine.createSpy('create').and.returnValue(of({})),
            update: jasmine.createSpy('update').and.returnValue(of({})),
            reassign: jasmine.createSpy('reassign').and.returnValue(of({})),
            delete: jasmine.createSpy('delete').and.returnValue(of(void 0)),
        };
        const messageService = {
            add: jasmine.createSpy('add'),
        };
        const vehicleBrandsService = {
            getMunicipalities: jasmine.createSpy('getMunicipalities').and.resolveTo([]),
            getSectors: jasmine.createSpy('getSectors').and.resolveTo([]),
        };
        const userService = {
            searchSolicitudClients: jasmine.createSpy('searchSolicitudClients').and.returnValue(of({
                users: [],
                totalCount: 0,
            })),
        };
        const targetsService = {
            getTargetByImei: jasmine.createSpy('getTargetByImei').and.resolveTo({}),
        };
        const authService = {
            getCurrentUser: jasmine.createSpy('getCurrentUser').and.returnValue({
                id: 'root-1',
                root: true,
            }),
        };
        const confirmationService = {
            confirm: jasmine.createSpy('confirm'),
        };
        const component = new SolicitudesComponent(
            solicitudesService as any,
            vehicleBrandsService as any,
            {} as any,
            userService as any,
            targetsService as any,
            {} as any,
            {} as any,
            authService as any,
            messageService as any,
            confirmationService as any,
            {} as any,
            {} as any,
            {} as any,
        );
        spyOn(component, 'initRootLocationMap');
        spyOn(component, 'openInstallationModal');
        spyOn(component, 'loadSolicitudes');

        return {
            component,
            solicitudesService,
            vehicleBrandsService,
            userService,
            targetsService,
            authService,
            confirmationService,
            messageService,
        };
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

    it('defaults legacy processes to GPS and preserves a selected MTAG type', async () => {
        const { component, solicitudesService } = createComponent();
        const solicitud: Solicitud = {
            _id: 'request-device-type',
            type: 'instalacion',
            status: 'pendiente',
            installations: [{}],
        };

        await component.editSolicitud(solicitud);
        expect(component.selectedSolicitud?.installations?.[0].device_type).toBe('gps');

        component.selectedSolicitud!.installations![0].device_type = 'mtag_a';
        await component.saveSolicitud();

        const savedSolicitud = solicitudesService.update.calls.mostRecent().args[1] as Solicitud;
        expect(savedSolicitud.installations?.[0].device_type).toBe('mtag_a');
        expect(component.getProcessDeviceTypeLabel(savedSolicitud.installations?.[0])).toBe('MTAG-A');
    });

    it('keeps the technician and schedule immutable after the request was accepted', async () => {
        const { component, solicitudesService, messageService } = createComponent();
        const solicitud: Solicitud = {
            _id: 'accepted-request-id',
            type: 'instalacion',
            status: 'aceptada',
            technician_response: 'aceptada',
            mechanic_id: 'technician-1',
            scheduled_date: '2026-08-04T10:07:00.000Z',
            installations: [{ scheduled_date: '2026-08-04T10:07:00.000Z' }],
        };

        await component.editSolicitud(solicitud);

        expect(component.isSelectedSolicitudAssignmentLocked()).toBeTrue();
        component.openTechnicianSelection();
        expect(component.technicianSelectionDialogVisible).toBeFalse();
        expect(messageService.add).toHaveBeenCalledWith(
            jasmine.objectContaining({ summary: 'Asignación confirmada' }),
        );
        component.technicianRecommendation = {
            technician_id: 'technician-3',
            technician_name: 'Técnico recomendado',
            distance_km: 1,
            reason: 'Disponible',
        };
        component.applyTechnicianRecommendation();
        expect(component.selectedSolicitud?.mechanic_id).toBe('technician-1');

        component.selectedSolicitud!.mechanic_id = 'technician-2';
        component.selectedSolicitud!.scheduled_date = '2026-08-04T12:00';
        component.selectedSolicitud!.installations![0].scheduled_date = '2026-08-04T12:00';

        await component.saveSolicitud();

        const savedSolicitud = solicitudesService.update.calls.mostRecent().args[1] as Solicitud;
        expect(savedSolicitud.mechanic_id).toBe('technician-1');
        expect(savedSolicitud.scheduled_date).toBe('2026-08-04T10:07:00.000Z');
        expect(savedSolicitud.installations?.[0]?.scheduled_date)
            .toBe('2026-08-04T10:07:00.000Z');
    });

    it('reassigns through the dedicated modal only when a reason is provided', async () => {
        const { component, solicitudesService, messageService } = createComponent();
        const solicitud: Solicitud = {
            _id: 'accepted-request-id',
            type: 'instalacion',
            status: 'aceptada',
            technician_response: 'aceptada',
            mechanic_id: 'technician-1',
            scheduled_date: '2026-08-04T10:00',
            installations: [{ scheduled_date: '2026-08-04T10:00' }],
        };

        component.openReassignmentDialog(solicitud);

        expect(component.reassignmentDialogVisible).toBeTrue();
        expect(component.reassignmentMechanicId).toBe('technician-1');
        component.reassignmentMechanicId = 'technician-2';
        component.reassignmentScheduledDate = '2026-08-04T12:30';

        await component.saveSolicitudReassignment();

        expect(solicitudesService.reassign).not.toHaveBeenCalled();
        expect(component.reassignmentError).toContain('al menos 5 caracteres');

        component.reassignmentReason = 'El técnico original no estará disponible.';
        await component.saveSolicitudReassignment();

        expect(solicitudesService.reassign).toHaveBeenCalledWith(
            'accepted-request-id',
            {
                mechanic_id: 'technician-2',
                scheduled_date: '2026-08-04T12:30',
                reason: 'El técnico original no estará disponible.',
            },
        );
        expect(component.reassignmentDialogVisible).toBeFalse();
        expect(messageService.add).toHaveBeenCalledWith(
            jasmine.objectContaining({ summary: 'Solicitud reasignada' }),
        );
    });

    it('matches the GPS change detail to the chequeo installation by previous IMEI', () => {
        const { component } = createComponent();
        const sourceInstallation = { device_imei: 'OLD-IMEI-2' };
        const solicitud: Solicitud = {
            _id: 'chequeo-id',
            type: 'chequeo',
            status: 'por_confirmar',
            installations: [sourceInstallation],
            gps_change: {
                _id: 'cambio-id',
                type: 'cambio',
                status: 'completada',
                installations: [
                    { device_imei: 'OLD-IMEI-1', new_device_imei: 'NEW-IMEI-1' },
                    { device_imei: 'OLD-IMEI-2', new_device_imei: 'NEW-IMEI-2' },
                ],
            },
        };

        const result = component.getGpsChangeInstallation(
            solicitud,
            sourceInstallation,
            0,
        );

        expect(result?.new_device_imei).toBe('NEW-IMEI-2');
        expect(component.getGpsChangeTitle(solicitud)).toBe('Cambio de GPS realizado');
        expect(component.getGpsChangeStatusLabel(solicitud)).toBe('Completada');
    });

    it('shows a GPS replacement performed directly inside the chequeo recovery', () => {
        const { component } = createComponent();
        const sourceInstallation = {
            device_imei: 'OLD-INLINE-IMEI',
            sim_card_number: 'OLD-INLINE-SIM',
            new_device_imei: 'NEW-INLINE-IMEI',
            new_sim_card_number: 'NEW-INLINE-SIM',
            completed: true,
            checkup_recovery: {
                gps_replacement_attempted: true,
                previous_device_imei: 'OLD-INLINE-IMEI',
                replacement_device_imei: 'NEW-INLINE-IMEI',
            },
        };
        const solicitud: Solicitud = {
            _id: 'inline-chequeo-id',
            type: 'chequeo',
            status: 'por_confirmar',
            installations: [sourceInstallation],
        };

        const result = component.getGpsChangeInstallation(
            solicitud,
            sourceInstallation,
            0,
        );

        expect(result).toEqual(jasmine.objectContaining({
            device_imei: 'OLD-INLINE-IMEI',
            new_device_imei: 'NEW-INLINE-IMEI',
            new_sim_card_number: 'NEW-INLINE-SIM',
        }));
        expect(component.getGpsChangeTitle(solicitud)).toBe('Cambio de GPS realizado');
        expect(component.isGpsChangeCompleted(solicitud)).toBeTrue();
    });

    it('describes every persisted checkup recovery action with readable labels', () => {
        const { component } = createComponent();
        const installation = {
            process_type: 'chequeo',
            connection_status: 'bien_conectado',
            resolution_type: 'cambio_gps',
            checkup_recovery: {
                connection_checked: true,
                connection_corrected: true,
                power_checked: true,
                power_corrected: false,
                sim_replacement_attempted: true,
                gps_replacement_attempted: true,
                last_online_check_step: 'gps' as const,
                online_confirmed: true,
                online_confirmed_at: '2026-07-31T12:00:00.000Z',
            },
        };

        expect(component.hasCheckupRecoveryDetails(installation)).toBeTrue();
        expect(component.getCheckupResolutionLabel(installation.resolution_type)).toBe('GPS reemplazado');
        expect(component.getConnectionStatusLabel(installation.connection_status)).toBe('Bien conectado');
        expect(component.getRecoveryStepLabel(installation.checkup_recovery.last_online_check_step)).toBe('Cambio de GPS');
    });

    it('loads the replacement GPS evidence only when the process detail is opened', async () => {
        const { component, targetsService } = createComponent();
        targetsService.getTargetByImei.and.resolveTo({
            chasis_img: { url: 'https://files.example/chassis.jpg' },
            lugar_instalacion_despues_img: {
                url: 'https://files.example/after.jpg',
                label: 'Instalación terminada',
            },
            activation_status: {
                completed: true,
                steps: [{ label: 'Validar SIM', status: 'success' }],
            },
        });
        const installation = {
            process_type: 'chequeo',
            device_imei: 'OLD-IMEI',
            checkup_recovery: {
                gps_replacement_attempted: true,
                replacement_device_imei: 'NEW-IMEI',
            },
        };
        const solicitud: Solicitud = {
            _id: 'request-id',
            type: 'chequeo',
            status: 'en_progreso',
            installations: [installation],
        };

        component.openKanbanProcessDetails(solicitud, installation, 0);
        await Promise.resolve();
        await Promise.resolve();

        expect(targetsService.getTargetByImei).toHaveBeenCalledOnceWith('NEW-IMEI');
        expect(component.getProcessDeviceEvidence()).toEqual([
            jasmine.objectContaining({ label: 'Foto del chasis', url: 'https://files.example/chassis.jpg' }),
            jasmine.objectContaining({ label: 'Instalación terminada', url: 'https://files.example/after.jpg' }),
        ]);
        expect(component.getProcessActivationStatusLabel()).toBe('Activación completada');
        expect(component.getProcessActivationSteps()[0].label).toBe('Validar SIM');
    });

    it('loads installation photos through the request details endpoint without device-module access', async () => {
        const { component, solicitudesService, targetsService } = createComponent();
        (solicitudesService as any).getInstallationDeviceDetails = jasmine
            .createSpy('getInstallationDeviceDetails')
            .and.returnValue(of({
                imei: 'INSTALL-IMEI',
                device: {
                    placa_img: { url: 'https://files.example/plate.jpg' },
                    vehiculo_exterior_antes_img: { url: 'https://files.example/exterior.jpg' },
                },
            }));
        const installation = {
            process_type: 'instalacion',
            device_imei: 'INSTALL-IMEI',
        };
        const solicitud: Solicitud = {
            _id: 'request-id',
            type: 'instalacion',
            status: 'completada',
            installations: [installation],
        };

        component.openKanbanProcessDetails(solicitud, installation, 0);
        await Promise.resolve();
        await Promise.resolve();

        expect((solicitudesService as any).getInstallationDeviceDetails)
            .toHaveBeenCalledOnceWith('request-id', 0);
        expect(targetsService.getTargetByImei).not.toHaveBeenCalled();
        expect(component.getAllProcessEvidence()).toEqual([
            jasmine.objectContaining({ label: 'Foto de la placa', url: 'https://files.example/plate.jpg' }),
            jasmine.objectContaining({ label: 'Exterior del vehículo antes', url: 'https://files.example/exterior.jpg' }),
        ]);
    });

    it('keeps a persisted installation evidence snapshot and removes duplicate URLs', () => {
        const { component } = createComponent();
        const installation = {
            process_type: 'instalacion',
            images: ['https://files.example/diagnosis.jpg'],
            installation_evidence: [
                { label: 'Foto del chasis', url: 'https://files.example/chassis.jpg' },
                { label: 'Duplicada', url: 'https://files.example/chassis.jpg' },
            ],
        };

        expect(component.getAllProcessEvidence(installation)).toEqual([
            jasmine.objectContaining({
                label: 'Evidencia del diagnóstico 1',
                url: 'https://files.example/diagnosis.jpg',
            }),
            jasmine.objectContaining({
                label: 'Foto del chasis',
                url: 'https://files.example/chassis.jpg',
            }),
        ]);
    });

    it('orders the complete technician work as a readable step-by-step timeline', () => {
        const { component } = createComponent();
        component.processDetailsDevice = {
            chasis_img: { url: 'https://files.example/chassis.jpg' },
            activation_status: {
                completed: true,
                completedAt: '2026-07-31T15:00:00.000Z',
                steps: [
                    { label: 'Validar SIM', description: 'SIM disponible', status: 'success' },
                    { label: 'Configurar APN', status: 'success' },
                ],
                logs: [{ message: 'GPS respondió correctamente', time: '2026-07-31T14:59:00.000Z' }],
            },
        };
        const installation = {
            process_type: 'chequeo',
            device_imei: 'OLD-IMEI',
            new_device_imei: 'NEW-IMEI',
            sim_card_number: 'OLD-SIM',
            new_sim_card_number: 'NEW-SIM',
            diagnosis: 'GPS sin comunicación',
            resolution_type: 'cambio_gps',
            connection_status: 'bien_conectado',
            final_device_status: 'online',
            final_device_online: true,
            final_device_status_at: '2026-07-31T15:02:00.000Z',
            completed: true,
            images: ['https://files.example/diagnosis.jpg'],
            checkup_recovery: {
                connection_checked: true,
                connection_corrected: true,
                power_checked: true,
                power_corrected: false,
                sim_replacement_attempted: true,
                previous_sim_card_number: 'OLD-SIM',
                replacement_sim_card_number: 'NEW-SIM',
                gps_replacement_attempted: true,
                previous_device_imei: 'OLD-IMEI',
                replacement_device_imei: 'NEW-IMEI',
                last_online_check_step: 'gps' as const,
                online_confirmed: true,
                online_confirmed_at: '2026-07-31T15:01:00.000Z',
            },
        };
        const solicitud: Solicitud = {
            _id: 'timeline-request',
            type: 'chequeo',
            status: 'completada',
            technician_response: 'aceptada',
            installations: [installation],
        };

        const timeline = component.getProcessTechnicianTimeline(solicitud, installation, 0);

        expect(timeline.map(step => step.title)).toEqual([
            'Aceptó el proceso asignado',
            'Revisó los datos iniciales del proceso',
            'Inició el chequeo del GPS',
            'Revisó la conexión del GPS',
            'Revisó la alimentación eléctrica',
            'Reemplazó la SIM card',
            'Realizó el cambio de GPS',
            'Activó y validó el GPS',
            'Confirmó el GPS nuevamente en línea',
            'Registró el resultado técnico',
            'Adjuntó las evidencias del trabajo',
            'Finalizó este proceso',
        ]);
        const gpsChangeStep = timeline.find(step => step.title === 'Realizó el cambio de GPS');
        expect(gpsChangeStep?.details).toContain(jasmine.objectContaining({ label: 'GPS retirado', value: 'OLD-IMEI' }));
        expect(gpsChangeStep?.details).toContain(jasmine.objectContaining({ label: 'GPS colocado', value: 'NEW-IMEI' }));
        expect(timeline.find(step => step.title === 'Activó y validó el GPS')?.details).toContain(
            jasmine.objectContaining({ label: 'Validación 1: Validar SIM', value: 'Completado · SIM disponible' }),
        );
        expect(timeline.find(step => step.title === 'Finalizó este proceso')?.details).toContain(
            jasmine.objectContaining({ label: 'Estado del GPS al finalizar', value: 'En línea al finalizar' }),
        );
    });

    it('labels final GPS states without replacing missing historical data with the current state', () => {
        const { component } = createComponent();

        const checkedAt = '2026-08-03T12:00:00.000Z';
        expect(component.getInstallationFinalDeviceStatusLabel({
            final_device_status: 'online',
            final_device_online: true,
            final_device_status_at: checkedAt,
        })).toBe('En línea al finalizar');
        expect(component.getInstallationFinalDeviceStatusLabel({
            final_device_status: 'offline',
            final_device_online: false,
            final_device_status_at: checkedAt,
        })).toBe('Fuera de línea al finalizar');
        expect(component.getInstallationFinalDeviceStatusLabel({
            final_device_status: 'No localizado',
            final_device_online: false,
            final_device_status_at: checkedAt,
        })).toBe('No localizado al finalizar');
        expect(component.getInstallationFinalDeviceStatusLabel({
            final_device_online: false,
            final_device_status_at: checkedAt,
        })).toBe('');
        expect(component.getInstallationFinalDeviceStatusLabel({
            final_device_status: 'unknown',
            final_device_online: false,
            final_device_status_at: checkedAt,
        })).toBe('');
        expect(component.getInstallationFinalDeviceStatusLabel({
            final_device_status: 'offline',
            final_device_online: false,
        })).toBe('');
        expect(component.getInstallationFinalDeviceStatusLabel({ completed: true })).toBe('');
        expect(component.hasInstallationFinalDeviceStatus({ completed: true })).toBeFalse();
    });

    it('shows the saved request creator and resolves legacy creator ids from the user cache', () => {
        const { component } = createComponent();

        expect(component.getSolicitudCreatorName({
            type: 'instalacion',
            status: 'pendiente',
            created_by_name: 'Fidelis Stephanie Familia Diaz',
        })).toBe('Fidelis Stephanie Familia Diaz');

        component.userNameCache['legacy-creator'] = 'Pedro González';
        expect(component.getSolicitudCreatorName({
            type: 'instalacion',
            status: 'pendiente',
            user_id: 'legacy-creator',
        })).toBe('Pedro González');
    });

    it('opens the process location in the internal map instead of navigating to Google Maps', () => {
        const { component } = createComponent();
        const installation = {
            process_type: 'instalacion',
            latitude: 18.735693,
            longitude: -70.162651,
            location_address: 'Ubicación de prueba',
        };
        const solicitud: Solicitud = {
            _id: 'request-with-location',
            type: 'instalacion',
            status: 'en_progreso',
            installations: [installation],
        };
        const initMap = spyOn<any>(component, 'initProcessLocationMap').and.resolveTo();
        jasmine.clock().install();
        try {
            component.openProcessLocationMap(solicitud, installation);
            jasmine.clock().tick(1);

            expect(component.processLocationMapDialogVisible).toBeTrue();
            expect(component.processLocationMapAddress).toBe('Ubicación de prueba');
            expect(component.processLocationMapCoordinates).toEqual({
                lat: 18.735693,
                lng: -70.162651,
            });
            expect(initMap).toHaveBeenCalledOnceWith(solicitud, installation);
            expect(component.getProcessTechnicianTimeline(solicitud, installation, 0)[1].showLocationAction).toBeTrue();
        } finally {
            jasmine.clock().uninstall();
        }
    });

    it('keeps technician filter options and filtered results stable across change detection reads', () => {
        const { component } = createComponent();
        component.availableTechnicians = [
            { _id: 'tech-1', name: 'Ana', last_name: 'Pérez' } as any,
            { _id: 'tech-2', name: 'Luis', last_name: 'Gómez' } as any,
        ];
        component.solicitudes = [
            { _id: 'sol-1', type: 'chequeo', status: 'pendiente', mechanic_id: 'tech-1' },
            { _id: 'sol-2', type: 'instalacion', status: 'pendiente', mechanic_id: 'tech-2' },
        ];

        const firstOptionsRead = component.topFilterTechnicianOptions;
        expect(component.topFilterTechnicianOptions).toBe(firstOptionsRead);

        component.topFilterTechnician = 'tech-1';
        const firstFilteredRead = component.filteredSolicitudes;

        expect(firstFilteredRead.map(solicitud => solicitud._id)).toEqual(['sol-1']);
        expect(component.filteredSolicitudes).toBe(firstFilteredRead);
        expect(component.getTechnicianById('tech-1')?.name).toBe('Ana');
    });

    it('still defaults a newly created request to the current local date and time', async () => {
        const { component } = createComponent();

        await component.openNew();

        expect(component.selectedSolicitud?.scheduled_date).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
        );
        expect(component.selectedSolicitud?.scheduled_date).toMatch(/:\d0$/);
    });

    it('floors scheduled minutes to ten-minute blocks before saving', async () => {
        const { component, solicitudesService } = createComponent();
        component.selectedSolicitud = {
            type: 'instalacion',
            status: 'pendiente',
            quantity: 2,
            scheduled_date: '2026-07-28T15:44',
            installations: [
                { device_type: 'gps' },
                { device_type: 'gps', scheduled_date: '2026-07-28T17:13' },
            ],
        };

        await component.saveSolicitud();

        const savedSolicitud = solicitudesService.create.calls.mostRecent().args[0] as Solicitud;
        expect(savedSolicitud.scheduled_date).toBe('2026-07-28T15:40');
        expect(savedSolicitud.installations?.[0]?.scheduled_date).toBe('2026-07-28T15:40');
        expect(savedSolicitud.installations?.[1]?.scheduled_date).toBe('2026-07-28T17:10');
    });

    it('shows a newly created request immediately and refreshes without blocking the board', async () => {
        const { component, solicitudesService } = createComponent();
        const created: Solicitud = {
            _id: 'new-request',
            type: 'instalacion',
            status: 'pendiente',
            client_name: 'Cliente nuevo',
            scheduled_date: '2026-07-28T15:40',
            installations: [{ device_type: 'gps' }],
        };
        solicitudesService.create.and.returnValue(of(created));
        component.selectedSolicitud = {
            type: 'instalacion',
            status: 'pendiente',
            client_name: 'Cliente nuevo',
            scheduled_date: '2026-07-28T15:40',
            installations: [{ device_type: 'gps' }],
        };

        await component.saveSolicitud();

        expect(component.solicitudes).toContain(created);
        expect(component.savingSolicitud).toBeFalse();
        expect(component.loadSolicitudes).toHaveBeenCalledWith(false, { silent: true });
    });

    it('shows the assigned process when the technician has another request less than one hour away', async () => {
        const { component, solicitudesService } = createComponent();
        solicitudesService.checkTechnicianScheduleConflict.and.returnValue(of({
            available: false,
            conflict: {
                solicitud_id: 'conflicting-request',
                type: 'chequeo',
                type_label: 'chequeo',
                client_name: 'Cliente ocupado',
                scheduled_date: '2026-07-30T15:30',
                difference_minutes: 30,
            },
        }));
        component.selectedSolicitud = {
            type: 'instalacion',
            status: 'pendiente',
            mechanic_id: 'technician-1',
            scheduled_date: '2026-07-30T16:00',
            installations: [{}],
        };

        const available = await component.validateSelectedTechnicianSchedule();

        expect(available).toBeFalse();
        expect(component.technicianScheduleConflict?.solicitud_id)
            .toBe('conflicting-request');
        expect(component.technicianScheduleConflictMessage).toContain(
            'tiene una solicitud de chequeo para Cliente ocupado',
        );
        expect(component.technicianScheduleConflictMessage).toContain(
            '3:30 p. m.',
        );
    });

    it('blocks saving while the assigned technician has a schedule conflict', async () => {
        const { component, solicitudesService, messageService } = createComponent();
        solicitudesService.checkTechnicianScheduleConflict.and.returnValue(of({
            available: false,
            conflict: {
                solicitud_id: 'conflicting-request',
                type: 'instalacion',
                type_label: 'instalación',
                scheduled_date: '2026-07-30T10:30',
                difference_minutes: 30,
            },
        }));
        component.selectedSolicitud = {
            type: 'instalacion',
            status: 'pendiente',
            mechanic_id: 'technician-1',
            scheduled_date: '2026-07-30T10:00',
            installations: [{ device_type: 'gps' }],
        };

        await component.saveSolicitud();

        expect(solicitudesService.create).not.toHaveBeenCalled();
        expect(component.showRootDetailsData).toBeTrue();
        expect(messageService.add).toHaveBeenCalledWith(
            jasmine.objectContaining({
                summary: 'Técnico no disponible',
            }),
        );
    });

    it('shows the closest available technician as the recommendation', async () => {
        const { component, solicitudesService } = createComponent();
        solicitudesService.getTechnicianRecommendation.and.returnValue(of({
            recommendation: {
                technician_id: 'technician-2',
                technician_name: 'Técnico Cercano',
                distance_km: 2.4,
                reason: 'Está disponible y su último proceso quedó a 2.4 km.',
            },
            evaluated_technicians: 4,
            available_technicians: 3,
        }));
        component.selectedSolicitud = {
            type: 'instalacion',
            status: 'pendiente',
            scheduled_date: '2026-07-30T10:00',
            latitude: 18.4861,
            longitude: -69.9312,
            installations: [{}],
        };

        await component.refreshTechnicianRecommendation();

        expect(solicitudesService.getTechnicianRecommendation)
            .toHaveBeenCalledWith({
                scheduledDate: '2026-07-30T10:00',
                latitude: 18.4861,
                longitude: -69.9312,
                excludeId: undefined,
            });
        expect(component.technicianRecommendation?.technician_id)
            .toBe('technician-2');
        expect(component.technicianRecommendationMessage)
            .toBe('3 de 4 técnicos están disponibles para este horario.');
    });

    it('describes the distance and age of the technician app location', () => {
        const { component } = createComponent();
        jasmine.clock().install();
        jasmine.clock().mockDate(new Date('2026-07-30T15:00:00.000Z'));

        try {
            expect(component.getTechnicianRecommendationLocationText({
                technician_id: 'technician-mobile',
                technician_name: 'Técnico Móvil',
                distance_km: 2.4,
                reason: 'Disponible y cercano.',
                location_reference: {
                    type: 'app',
                    source: 'mobile',
                    recorded_at: '2026-07-30T14:55:00.000Z',
                    latitude: 18.4861,
                    longitude: -69.9312,
                    distance_km: 2.4,
                },
            })).toBe(
                'Técnico a 2.4 km · hace 5 minutos · según su ubicación marcada en la app',
            );
        } finally {
            jasmine.clock().uninstall();
        }
    });

    it('assigns the recommended technician and validates the selected schedule', async () => {
        const { component, solicitudesService } = createComponent();
        component.selectedSolicitud = {
            type: 'instalacion',
            status: 'pendiente',
            scheduled_date: '2026-07-30T10:00',
            latitude: 18.4861,
            longitude: -69.9312,
            installations: [{}],
        };
        component.technicianRecommendation = {
            technician_id: 'technician-2',
            technician_name: 'Técnico Cercano',
            distance_km: 2.4,
            reason: 'Disponible y cercano.',
        };

        component.applyTechnicianRecommendation();
        await Promise.resolve();

        expect(component.selectedSolicitud.mechanic_id).toBe('technician-2');
        expect(solicitudesService.checkTechnicianScheduleConflict)
            .toHaveBeenCalledWith(
                'technician-2',
                '2026-07-30T10:00',
                undefined,
            );
        expect(component.isRecommendedTechnicianSelected).toBeTrue();
    });

    it('filters technician cards by name, email or phone', () => {
        const { component } = createComponent();
        component.availableTechnicians = [
            {
                _id: 'tech-ana',
                name: 'Ana',
                last_name: 'Pérez',
                email: 'ana@example.com',
                phone: '8095551000',
            },
            {
                _id: 'tech-luis',
                name: 'Luis',
                last_name: 'Díaz',
                email: 'luis@example.com',
                phone: '8295552000',
            },
        ];

        component.technicianSearchQuery = 'ana';
        expect(component.filteredTechniciansForSelection.map(
            technician => technician._id,
        )).toEqual(['tech-ana']);

        component.technicianSearchQuery = '8295552000';
        expect(component.filteredTechniciansForSelection.map(
            technician => technician._id,
        )).toEqual(['tech-luis']);
    });

    it('selects and clears a technician from the card picker', () => {
        const { component } = createComponent();
        const technician = {
            _id: 'tech-selected',
            name: 'María',
            last_name: 'López',
        } as any;
        component.availableTechnicians = [technician];
        component.selectedSolicitud = {
            type: 'instalacion',
            status: 'pendiente',
            installations: [{}],
        };
        component.technicianSelectionDialogVisible = true;
        const validationSpy = spyOn(
            component,
            'onSelectedTechnicianChange',
        );

        component.selectSolicitudTechnician(technician);

        expect(component.selectedSolicitud.mechanic_id)
            .toBe('tech-selected');
        expect(component.selectedSolicitudTechnician).toBe(technician);
        expect(component.technicianSelectionDialogVisible).toBeFalse();
        expect(validationSpy).toHaveBeenCalledTimes(1);

        component.clearSolicitudTechnician();

        expect(component.selectedSolicitud.mechanic_id).toBeUndefined();
        expect(validationSpy).toHaveBeenCalledTimes(2);
    });

    it('asks for an exact location before calculating a recommendation', async () => {
        const { component, solicitudesService } = createComponent();
        component.selectedSolicitud = {
            type: 'instalacion',
            status: 'pendiente',
            scheduled_date: '2026-07-30T10:00',
            installations: [{}],
        };

        await component.refreshTechnicianRecommendation();

        expect(solicitudesService.getTechnicianRecommendation)
            .not.toHaveBeenCalled();
        expect(component.technicianRecommendationMessage).toContain(
            'Configura la ubicación exacta',
        );
    });

    it('marks an active request as overdue after its scheduled local date and time', () => {
        const { component } = createComponent();
        const solicitud: Solicitud = {
            type: 'instalacion',
            status: 'pendiente',
            scheduled_date: '2026-07-30T10:00',
        };

        expect(component.isSolicitudOverdue(
            solicitud,
            new Date(2026, 6, 30, 10, 1),
        )).toBeTrue();
    });

    it('does not mark a request as overdue before its scheduled time', () => {
        const { component } = createComponent();
        const solicitud: Solicitud = {
            type: 'instalacion',
            status: 'en_progreso',
            scheduled_date: '2026-07-30T10:00',
        };

        expect(component.isSolicitudOverdue(
            solicitud,
            new Date(2026, 6, 30, 9, 59),
        )).toBeFalse();
    });

    it('uses the first installation date when the request has no root scheduled date', () => {
        const { component } = createComponent();
        const solicitud: Solicitud = {
            type: 'instalacion',
            status: 'pendiente',
            installations: [{ scheduled_date: '2026-07-29T16:00' }],
        };

        expect(component.isSolicitudOverdue(
            solicitud,
            new Date(2026, 6, 30, 8, 0),
        )).toBeTrue();
    });

    it('never marks requests awaiting confirmation, completed or cancelled as overdue', () => {
        const { component } = createComponent();
        const now = new Date(2026, 6, 30, 8, 0);
        const awaitingConfirmation: Solicitud = {
            type: 'instalacion',
            status: 'por_confirmar',
            scheduled_date: '2026-07-29T16:00',
        };
        const completed: Solicitud = {
            type: 'instalacion',
            status: 'completada',
            scheduled_date: '2026-07-29T16:00',
        };
        const cancelled: Solicitud = {
            type: 'instalacion',
            status: 'cancelada',
            scheduled_date: '2026-07-29T16:00',
        };

        expect(component.isSolicitudOverdue(awaitingConfirmation, now)).toBeFalse();
        expect(component.isSolicitudOverdue(completed, now)).toBeFalse();
        expect(component.isSolicitudOverdue(cancelled, now)).toBeFalse();
    });

    it('shows the finalization date and time for requests awaiting confirmation', () => {
        const { component } = createComponent();
        const finalizedAt = new Date(2026, 6, 30, 15, 40);
        const solicitud: Solicitud = {
            type: 'instalacion',
            status: 'por_confirmar',
            completed_date: finalizedAt.toISOString(),
        };

        expect(component.getSolicitudFinalizedDateDisplay(solicitud))
            .toBe('30/07/2026 a las 3:40 p. m.');
    });

    it('uses updatedAt as the finalization date for legacy requests', () => {
        const { component } = createComponent();
        const finalizedAt = new Date(2026, 6, 30, 9, 10);
        const solicitud: Solicitud = {
            type: 'instalacion',
            status: 'por_confirmar',
            updatedAt: finalizedAt.toISOString(),
        };

        expect(component.getSolicitudFinalizedDateDisplay(solicitud))
            .toBe('30/07/2026 a las 9:10 a. m.');
    });

    it('shows the scheduled time in twelve-hour format on request cards', () => {
        const { component } = createComponent();

        expect(component.getScheduledDateDisplay({
            type: 'instalacion',
            status: 'pendiente',
            scheduled_date: '2026-07-30T15:40',
        })).toContain('3:40 p. m.');

        expect(component.getScheduledDateDisplay({
            type: 'instalacion',
            status: 'pendiente',
            scheduled_date: '2026-07-30T00:10',
        })).toContain('12:10 a. m.');
    });

    it('keeps a shortened Google Maps link even when it does not expose coordinates', () => {
        const { component } = createComponent();
        component.selectedSolicitud = {
            type: 'instalacion',
            status: 'pendiente',
            latitude: 18.5,
            longitude: -69.9,
            installations: [{ latitude: 18.5, longitude: -69.9 }],
        };
        component.rootGoogleMapsLink = 'https://maps.app.goo.gl/AbCdEf123';

        component.applyRootGoogleMapsLink();

        expect(component.selectedSolicitud.google_maps_url).toBe(
            'https://maps.app.goo.gl/AbCdEf123',
        );
        expect(component.selectedSolicitud.installations?.[0]?.google_maps_url).toBe(
            'https://maps.app.goo.gl/AbCdEf123',
        );
        expect(component.selectedSolicitud.latitude).toBeUndefined();
        expect(component.selectedSolicitud.longitude).toBeUndefined();
        expect(component.selectedSolicitud.installations?.[0]?.latitude).toBeUndefined();
        expect(component.selectedSolicitud.installations?.[0]?.longitude).toBeUndefined();
    });

    it('extracts coordinates from a full Google Maps link while preserving the original link', () => {
        const { component } = createComponent();
        component.selectedSolicitud = {
            type: 'instalacion',
            status: 'pendiente',
            installations: [{}],
        };
        component.rootGoogleMapsLink =
            'https://www.google.com/maps/place/Test/@18.4861,-69.9312,17z';

        component.applyRootGoogleMapsLink();

        expect(component.selectedSolicitud.google_maps_url).toContain(
            'https://www.google.com/maps/place/Test/@18.4861,-69.9312,17z',
        );
        expect(component.selectedSolicitud.latitude).toBe(18.4861);
        expect(component.selectedSolicitud.longitude).toBe(-69.9312);
        expect(component.selectedSolicitud.installations?.[0]?.latitude).toBe(18.4861);
        expect(component.selectedSolicitud.installations?.[0]?.longitude).toBe(-69.9312);
    });

    it('selects an existing client and autocompletes the saved Google Maps link', async () => {
        const { component } = createComponent();
        component.selectedSolicitud = {
            type: 'instalacion',
            status: 'pendiente',
            installations: [{}],
        };

        await component.selectSolicitudClient({
            _id: 'client-1',
            name: 'Ana',
            last_name: 'Pérez',
            email: 'ana@example.com',
            phone: '8095551234',
            affiliation_type_id: 'cliente',
            static_location_url: 'https://maps.app.goo.gl/AbCdEf123',
        } as any);

        expect(component.selectedSolicitud.client_id).toBe('client-1');
        expect(component.selectedSolicitud.client_name).toBe('Ana Pérez');
        expect(component.selectedSolicitud.client_email).toBe('ana@example.com');
        expect(component.selectedSolicitud.client_phone).toBe('8095551234');
        expect(component.rootGoogleMapsLink).toBe('https://maps.app.goo.gl/AbCdEf123');
        expect(component.selectedSolicitud.google_maps_url).toBe(
            'https://maps.app.goo.gl/AbCdEf123',
        );
        expect(component.selectedSolicitud.installations?.[0]?.google_maps_url).toBe(
            'https://maps.app.goo.gl/AbCdEf123',
        );
    });

    it('creates the temporary request client using only the WhatsApp number when no account exists', async () => {
        const { component } = createComponent();
        component.selectedSolicitud = {
            type: 'instalacion',
            status: 'pendiente',
            client_id: 'old-client',
            client_name: 'Cliente anterior',
            client_email: 'anterior@example.com',
            client_phone: '8090000000',
            google_maps_url: 'https://maps.app.goo.gl/OldLink',
            installations: [{ google_maps_url: 'https://maps.app.goo.gl/OldLink' }],
        };
        component.rootGoogleMapsLink = 'https://maps.app.goo.gl/OldLink';
        component.newClientWhatsapp = '+1 (809) 555-1234';

        await component.confirmNewClientWhatsapp();

        expect(component.selectedSolicitud.client_id).toBeUndefined();
        expect(component.selectedSolicitud.client_name).toBe('');
        expect(component.selectedSolicitud.client_email).toBe('');
        expect(component.selectedSolicitud.client_phone).toBe('18095551234');
        expect(component.selectedSolicitud.google_maps_url).toBeUndefined();
        expect(component.selectedSolicitud.installations?.[0]?.google_maps_url).toBeUndefined();
    });

    it('selects and displays the existing client when the WhatsApp number already belongs to an account', async () => {
        const { component, userService } = createComponent();
        const existingClient = {
            _id: 'existing-client',
            name: 'Ana',
            last_name: 'Pérez',
            email: 'ana@example.com',
            phone: '8095551234',
            affiliation_type_id: 'cliente',
            static_location_url: 'https://maps.app.goo.gl/ClientLocation',
        };
        userService.searchSolicitudClients.and.returnValue(of({
            users: [existingClient],
            totalCount: 1,
        }));
        component.selectedSolicitud = {
            type: 'instalacion',
            status: 'pendiente',
            installations: [{}],
        };
        component.newClientWhatsapp = '+1 (809) 555-1234';

        component.onNewClientWhatsappChange();
        await component.confirmNewClientWhatsapp();

        expect(userService.searchSolicitudClients).toHaveBeenCalledWith('18095551234', 0, 20);
        expect(component.selectedSolicitud.client_id).toBe('existing-client');
        expect(component.selectedSolicitud.client_name).toBe('Ana Pérez');
        expect(component.selectedSolicitud.client_email).toBe('ana@example.com');
        expect(component.selectedSolicitud.client_phone).toBe('8095551234');
        expect(component.rootGoogleMapsLink).toBe('https://maps.app.goo.gl/ClientLocation');
    });

    it('uses the same cancellation reason catalog and blocks a deinstallation without a reason', async () => {
        const { component, solicitudesService } = createComponent();
        component.selectedSolicitud = {
            type: 'desinstalacion',
            status: 'pendiente',
            quantity: 1,
            installations: [{ device_type: 'gps', device_imei: '111111111111111' }],
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
            installations: [{ device_type: 'gps', device_imei: '111111111111111' }],
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
            installations: [{ device_type: 'gps', device_imei: '111111111111111' }],
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
            installations: [{ device_type: 'gps', device_imei: '111111111111111' }],
        };

        await component.saveSolicitud();

        expect(component.completionConfirmDialogVisible).toBeTrue();
        expect(component.completionDeinstallationReasonLabel).toBe('');
    });

    it('requires a written reason before cancelling a request', () => {
        const { component, solicitudesService } = createComponent();
        const solicitud: Solicitud = {
            _id: 'request-cancel',
            type: 'instalacion',
            status: 'pendiente',
            client_name: 'Cliente prueba',
        };

        component.cancelSolicitud(solicitud);
        component.cancellationReason = '   ';
        component.confirmSolicitudCancellation();

        expect(component.cancellationDialogVisible).toBeTrue();
        expect(component.cancellationReasonSubmitted).toBeTrue();
        expect(solicitudesService.update).not.toHaveBeenCalled();
    });

    it('keeps cancelled out of the normal status selector options', () => {
        const { component } = createComponent();

        expect(
            component.editableStatusOptions.some(
                option => option.value === 'cancelada',
            ),
        ).toBeFalse();
    });

    it('stores a cancelled request with its trimmed reason', () => {
        const { component, solicitudesService } = createComponent();
        const solicitud: Solicitud = {
            _id: 'request-cancel',
            type: 'instalacion',
            status: 'pendiente',
        };

        component.cancelSolicitud(solicitud);
        component.cancellationReason = '  El cliente solicitó cancelar.  ';
        component.confirmSolicitudCancellation();

        expect(solicitudesService.update).toHaveBeenCalledOnceWith(
            'request-cancel',
            {
                status: 'cancelada',
                cancellation_reason: 'El cliente solicitó cancelar.',
            },
        );
        expect(component.cancellationDialogVisible).toBeFalse();
        expect(component.cancellationSolicitud).toBeNull();
        expect(component.loadSolicitudes).toHaveBeenCalledWith(false);
    });

    it('opens a blank request form after cancelling when that option is selected', () => {
        const { component } = createComponent();
        const solicitud: Solicitud = {
            _id: 'request-cancel-new',
            type: 'chequeo',
            status: 'en_progreso',
            client_name: 'Cliente anterior',
            installations: [{ plate: 'A123456' }],
        };

        component.cancelSolicitud(solicitud);
        component.cancellationReason = 'El cliente solicitó otra visita.';
        component.confirmSolicitudCancellation('new');

        expect(component.dialogVisible).toBeTrue();
        expect(component.isEditMode).toBeFalse();
        expect(component.selectedSolicitud).toEqual(
            jasmine.objectContaining({
                type: 'instalacion',
                status: 'pendiente',
                client_name: '',
            }),
        );
        expect(component.selectedSolicitud?._id).toBeUndefined();
    });

    it('opens a clean duplicate after cancelling and keeps the request input data', () => {
        const { component } = createComponent();
        const solicitud: Solicitud = {
            _id: 'request-cancel-duplicate',
            type: 'chequeo',
            status: 'en_progreso',
            technician_response: 'aceptada',
            cancellation_reason: 'Motivo anterior',
            client_name: 'Cliente duplicado',
            client_phone: '8095550101',
            mechanic_id: 'technician-1',
            scheduled_date: '2026-08-05T10:30:00.000Z',
            description: 'Revisar el GPS del vehículo.',
            quantity: 1,
            installations: [{
                plate: 'A123456',
                device_imei: '123456789012345',
                scheduled_date: '2026-08-05T10:30:00.000Z',
                diagnosis: 'Diagnóstico de la solicitud anterior',
                completed: true,
                images: ['https://example.com/evidence.jpg'],
            }],
        };

        component.cancelSolicitud(solicitud);
        component.cancellationReason = 'Se necesita generar una solicitud sustituta.';
        component.confirmSolicitudCancellation('duplicate');

        expect(component.dialogVisible).toBeTrue();
        expect(component.isEditMode).toBeFalse();
        expect(component.selectedSolicitud).toEqual(
            jasmine.objectContaining({
                type: 'chequeo',
                status: 'pendiente',
                client_name: 'Cliente duplicado',
                client_phone: '8095550101',
                mechanic_id: 'technician-1',
                description: 'Revisar el GPS del vehículo.',
            }),
        );
        expect(component.selectedSolicitud?._id).toBeUndefined();
        expect(component.selectedSolicitud?.technician_response).toBeUndefined();
        expect(component.selectedSolicitud?.cancellation_reason).toBeUndefined();
        expect(component.selectedSolicitud?.installations?.[0]).toEqual(
            jasmine.objectContaining({
                plate: 'A123456',
                device_imei: '123456789012345',
            }),
        );
        expect(component.selectedSolicitud?.installations?.[0].diagnosis).toBeUndefined();
        expect(component.selectedSolicitud?.installations?.[0].completed).toBeUndefined();
        expect(component.selectedSolicitud?.installations?.[0].images).toBeUndefined();
    });

    it('closes only administrative rejections and keeps technician rejections pending', () => {
        const { component } = createComponent();
        const technicianRejection: Solicitud = {
            _id: 'technician-rejection',
            type: 'instalacion',
            status: 'rechazada',
            technician_response: 'rechazada',
        };
        const administrativeRejection: Solicitud = {
            _id: 'administrative-rejection',
            type: 'instalacion',
            status: 'rechazada',
            cancellation_reason: 'El cliente canceló la visita.',
        };
        component.solicitudes = [technicianRejection, administrativeRejection];

        expect(component.pendientes.map(item => item._id)).toEqual(['technician-rejection']);
        expect(component.completadas.map(item => item._id)).toEqual(['administrative-rejection']);
        expect(component.isSolicitudClosed(technicianRejection)).toBeFalse();
        expect(component.isSolicitudClosed(administrativeRejection)).toBeTrue();
    });

    it('does not allow a non-root user to delete a request', () => {
        const {
            component,
            solicitudesService,
            authService,
            confirmationService,
            messageService,
        } = createComponent();
        authService.getCurrentUser.and.returnValue({
            id: 'employee-1',
            root: false,
        });

        component.deleteSolicitud({
            _id: 'request-delete',
            type: 'instalacion',
            status: 'pendiente',
        });

        expect(component.isRootUser).toBeFalse();
        expect(confirmationService.confirm).not.toHaveBeenCalled();
        expect(solicitudesService.delete).not.toHaveBeenCalled();
        expect(messageService.add).toHaveBeenCalledWith(
            jasmine.objectContaining({
                summary: 'Acceso restringido',
            }),
        );
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

    it('loads every backend page before applying the Kanban date range', async () => {
        const { component, solicitudesService } = createComponent();
        const allSolicitudes: Solicitud[] = [
            { _id: 'request-1', type: 'instalacion', status: 'pendiente', scheduled_date: '2026-07-10T08:00' },
            { _id: 'request-2', type: 'chequeo', status: 'completada', scheduled_date: '2026-07-15T09:00' },
            { _id: 'request-3', type: 'cambio', status: 'en_progreso', scheduled_date: '2026-07-20T10:00' },
            { _id: 'request-4', type: 'desinstalacion', status: 'cancelada', scheduled_date: '2026-07-25T11:00' },
            { _id: 'request-5', type: 'reinstalacion', status: 'por_confirmar', scheduled_date: '2026-08-01T12:00' },
        ];

        (component.loadSolicitudes as jasmine.Spy).and.callThrough();
        (component as any).solicitudesPageSize = 2;
        solicitudesService.getAll.and.callFake((filters: { page?: number; limit?: number }) => {
            const page = filters.page || 1;
            const limit = filters.limit || 2;
            const start = (page - 1) * limit;
            return of({
                data: allSolicitudes.slice(start, start + limit),
                total: allSolicitudes.length,
            });
        });

        await component.loadSolicitudes();
        component.topFilterDateFrom = '2026-07-10';
        component.topFilterDateTo = '2026-07-25';

        expect(solicitudesService.getAll).toHaveBeenCalledTimes(3);
        expect(component.solicitudes.length).toBe(5);
        expect(component.filteredSolicitudes.map(item => item._id)).toEqual([
            'request-1',
            'request-2',
            'request-3',
            'request-4',
        ]);
        expect(component.completadas.map(item => item._id)).toEqual([
            'request-4',
            'request-2',
        ]);
    });

    it('releases a visible loader even when a silent refresh supersedes it', async () => {
        const { component, solicitudesService } = createComponent();
        const visibleResponse = new Subject<{ data: Solicitud[]; total: number }>();
        (component.loadSolicitudes as jasmine.Spy).and.callThrough();
        solicitudesService.getAll.and.returnValues(
            visibleResponse.asObservable(),
            of({ data: [], total: 0 }),
        );

        const visibleLoad = component.loadSolicitudes();
        expect(component.loading).toBeTrue();
        await component.loadSolicitudes(false, { silent: true });
        visibleResponse.next({ data: [], total: 0 });
        visibleResponse.complete();
        await visibleLoad;

        expect(component.loading).toBeFalse();
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

    it('exports matching requests from every status', () => {
        const { component } = createComponent();
        component.topFilterTechnician = 'tech-1';
        component.topFilterType = 'instalacion';
        component.topFilterDateFrom = '2026-07-10';
        component.topFilterDateTo = '2026-07-20';

        const filtered = (component as any).filterSolicitudesForExport([
            {
                _id: 'completed-match',
                type: 'instalacion',
                status: 'completada',
                mechanic_id: 'tech-1',
                scheduled_date: '2026-07-15T09:00',
                updatedAt: '2026-07-16T09:00:00Z',
            },
            {
                _id: 'cancelled-match',
                type: 'instalacion',
                status: 'cancelada',
                mechanic_id: 'tech-1',
                scheduled_date: '2026-07-20T09:00',
                updatedAt: '2026-07-21T09:00:00Z',
            },
            {
                _id: 'still-open',
                type: 'instalacion',
                status: 'en_progreso',
                mechanic_id: 'tech-1',
                scheduled_date: '2026-07-15T09:00',
            },
            {
                _id: 'other-technician',
                type: 'instalacion',
                status: 'completada',
                mechanic_id: 'tech-2',
                scheduled_date: '2026-07-15T09:00',
            },
            {
                _id: 'outside-date',
                type: 'instalacion',
                status: 'completada',
                mechanic_id: 'tech-1',
                scheduled_date: '2026-07-21T09:00',
            },
        ] as Solicitud[]);

        expect(filtered.map((solicitud: Solicitud) => solicitud._id)).toEqual([
            'cancelled-match',
            'completed-match',
            'still-open',
        ]);
    });

    it('builds the monthly calendar with every assigned request and keeps undated work visible', () => {
        const { component } = createComponent();
        component.availableTechnicians = [
            { _id: 'tech-1', name: 'Ana', last_name: 'Pérez' },
            { _id: 'tech-2', name: 'Luis', last_name: 'Díaz' },
        ];
        component.solicitudes = [
            {
                _id: 'assigned-open',
                type: 'instalacion',
                status: 'pendiente',
                mechanic_id: 'tech-1',
                client_name: 'Cliente Uno',
                scheduled_date: '2026-07-06T09:00',
            },
            {
                _id: 'assigned-closed',
                type: 'chequeo',
                status: 'completada',
                mechanic_id: 'tech-2',
                client_name: 'Cliente Dos',
                scheduled_date: '2026-07-20T15:30',
            },
            {
                _id: 'assigned-without-date',
                type: 'cambio',
                status: 'en_progreso',
                mechanic_id: 'tech-1',
                client_name: 'Cliente Tres',
            },
            {
                _id: 'unassigned',
                type: 'instalacion',
                status: 'pendiente',
                client_name: 'Sin técnico',
                scheduled_date: '2026-07-10T10:00',
            },
        ];
        component.topFilterDateFrom = '2026-07-25';
        component.topFilterDateTo = '2026-07-30';
        component.calendarCurrentMonth = new Date(2026, 6, 1);

        component.refreshSolicitudCalendar();

        const julyRequests = component.calendarDays
            .filter(day => day.inCurrentMonth)
            .flatMap(day => day.solicitudes)
            .map(solicitud => solicitud._id);
        expect(julyRequests).toEqual([
            'assigned-open',
            'assigned-closed',
        ]);
        expect(component.calendarMonthRequestCount).toBe(2);
        expect(component.calendarUnscheduledSolicitudes.map(
            solicitud => solicitud._id,
        )).toEqual(['assigned-without-date']);
    });

    it('filters the calendar by technician without using the Kanban date range', () => {
        const { component } = createComponent();
        component.solicitudes = [
            {
                _id: 'tech-one',
                type: 'instalacion',
                status: 'pendiente',
                mechanic_id: 'tech-1',
                scheduled_date: '2026-07-02T08:00',
            },
            {
                _id: 'tech-two',
                type: 'chequeo',
                status: 'en_progreso',
                mechanic_id: 'tech-2',
                scheduled_date: '2026-07-03T09:00',
            },
        ];
        component.topFilterDateFrom = '2026-08-01';
        component.topFilterDateTo = '2026-08-05';
        component.calendarCurrentMonth = new Date(2026, 6, 1);
        component.calendarTechnicianFilter = 'tech-2';

        component.refreshSolicitudCalendar();

        expect(
            component.calendarDays.flatMap(day => day.solicitudes)
                .map(solicitud => solicitud._id),
        ).toEqual(['tech-two']);
        expect(component.calendarMonthRequestCount).toBe(1);
    });

    it('opens a request from the calendar and closes the calendar view', () => {
        const { component } = createComponent();
        const solicitud: Solicitud = {
            _id: 'calendar-request',
            type: 'instalacion',
            status: 'pendiente',
            mechanic_id: 'tech-1',
            scheduled_date: '2026-07-03T09:00',
        };
        const editSpy = spyOn(component, 'editSolicitud').and.resolveTo();
        component.calendarDialogVisible = true;
        component.calendarBreakdownDialogVisible = true;

        component.openSolicitudFromCalendar(solicitud);

        expect(component.calendarDialogVisible).toBeFalse();
        expect(component.calendarBreakdownDialogVisible).toBeFalse();
        expect(editSpy).toHaveBeenCalledOnceWith(solicitud);
    });

    it('shows the assigned technician photo in the calendar before acceptance', () => {
        const { component } = createComponent();
        component.availableTechnicians = [{
            _id: 'tech-photo',
            name: 'María',
            last_name: 'López',
            photo: 'https://example.com/technician.jpg',
        }];
        const solicitud: Solicitud = {
            type: 'instalacion',
            status: 'pendiente',
            technician_response: undefined,
            mechanic_id: 'tech-photo',
        };

        expect(component.getCalendarTechnicianPhoto(solicitud))
            .toBe('https://example.com/technician.jpg');
        expect(component.getCalendarTechnicianInitials(solicitud)).toBe('ML');
    });

    it('opens the selected technician daily breakdown with only their work', () => {
        const { component } = createComponent();
        component.availableTechnicians = [
            { _id: 'tech-1', name: 'Ana', last_name: 'Pérez', photo: 'ana.jpg' },
            { _id: 'tech-2', name: 'Luis', last_name: 'Díaz' },
        ];
        const selected: Solicitud = {
            _id: 'tech-one-morning',
            type: 'instalacion',
            status: 'pendiente',
            mechanic_id: 'tech-1',
            scheduled_date: '2026-07-06T09:00',
        };
        const sameTechnician: Solicitud = {
            _id: 'tech-one-afternoon',
            type: 'chequeo',
            status: 'completada',
            mechanic_id: 'tech-1',
            scheduled_date: '2026-07-06T15:00',
        };
        const otherTechnician: Solicitud = {
            _id: 'tech-two',
            type: 'cambio',
            status: 'en_progreso',
            mechanic_id: 'tech-2',
            scheduled_date: '2026-07-06T10:00',
        };

        component.openCalendarTechnicianBreakdown({
            dateKey: '2026-07-06',
            dayNumber: 6,
            inCurrentMonth: true,
            isToday: false,
            solicitudes: [sameTechnician, otherTechnician, selected],
        }, selected);

        expect(component.calendarBreakdownDialogVisible).toBeTrue();
        expect(component.calendarBreakdownTechnicianName).toBe('Ana Pérez');
        expect(component.calendarBreakdownTechnicianPhoto).toBe('ana.jpg');
        expect(component.calendarBreakdownSolicitudes.map(item => item._id))
            .toEqual(['tech-one-morning', 'tech-one-afternoon']);
        expect(component.calendarBreakdownPendingCount).toBe(1);
        expect(component.calendarBreakdownCompletedCount).toBe(1);
    });

    it('details completed, pending and cancelled processes in the technician agenda', () => {
        const { component } = createComponent();
        const solicitud: Solicitud = {
            type: 'mixta',
            status: 'en_progreso',
            installations: [
                {
                    process_type: 'instalacion',
                    plate: 'A123456',
                    device_imei: '123456789012345',
                    completed: true,
                },
                {
                    process_type: 'chequeo',
                    plate: 'B654321',
                },
                {
                    process_type: 'cambio',
                    cancelled: true,
                },
            ],
        };

        const workItems = component.getCalendarWorkItems(solicitud);

        expect(workItems.map(item => item.label)).toEqual([
            'Instalación',
            'Chequeo',
            'Cambio',
        ]);
        expect(workItems.map(item => item.state)).toEqual([
            'completed',
            'pending',
            'cancelled',
        ]);
        expect(workItems[0].detail).toContain('A123456');
        expect(workItems[0].detail).toContain('IMEI 123456789012345');
    });

    it('opens one Kanban process in a read-only detail dialog without opening the request card', () => {
        const { component } = createComponent();
        const installation = {
            process_type: 'chequeo',
            plate: 'A123456',
            device_imei: '123456789012345',
        };
        const solicitud: Solicitud = {
            _id: 'request-with-processes',
            type: 'mixta',
            status: 'en_progreso',
            installations: [installation],
        };
        const event = {
            stopPropagation: jasmine.createSpy('stopPropagation'),
            preventDefault: jasmine.createSpy('preventDefault'),
        } as unknown as Event;

        component.openKanbanProcessDetails(solicitud, installation, 0, event);

        expect(event.stopPropagation).toHaveBeenCalled();
        expect(event.preventDefault).toHaveBeenCalled();
        expect(component.processDetailsDialogVisible).toBeTrue();
        expect(component.processDetailsSolicitud).toBe(solicitud);
        expect(component.processDetailsInstallation).toBe(installation);
        expect(component.processDetailsIndex).toBe(0);

        component.closeKanbanProcessDetails();

        expect(component.processDetailsDialogVisible).toBeFalse();
        expect(component.processDetailsSolicitud).toBeNull();
        expect(component.processDetailsInstallation).toBeNull();
    });

    it('only enables availability calls from 8:00 a. m. until before 7:00 p. m. in Santo Domingo', () => {
        const { component } = createComponent();

        expect(component.isTechnicianCallWindowOpen(new Date('2026-08-04T11:59:59.000Z'))).toBeFalse();
        expect(component.isTechnicianCallWindowOpen(new Date('2026-08-04T12:00:00.000Z'))).toBeTrue();
        expect(component.isTechnicianCallWindowOpen(new Date('2026-08-04T22:59:59.000Z'))).toBeTrue();
        expect(component.isTechnicianCallWindowOpen(new Date('2026-08-04T23:00:00.000Z'))).toBeFalse();
    });

    it('prioritizes Kanban requests by status and orders each status by scheduled date', () => {
        const { component } = createComponent();
        component.solicitudes = [
            { _id: 'pending-later', type: 'instalacion', status: 'pendiente', scheduled_date: '2026-08-06T15:00' },
            { _id: 'progress-later', type: 'instalacion', status: 'en_progreso', scheduled_date: '2026-08-05T12:30' },
            { _id: 'pending-child-schedule', type: 'instalacion', status: 'pendiente', installations: [{ scheduled_date: '2026-08-06T09:15' }] },
            { _id: 'progress-earlier', type: 'instalacion', status: 'en_progreso', scheduled_date: '2026-08-05T08:00' },
            { _id: 'pending-unscheduled', type: 'instalacion', status: 'pendiente' },
        ];

        expect(component.enProgreso.map(item => item._id)).toEqual([
            'progress-earlier',
            'progress-later',
        ]);
        expect(component.pendientes.map(item => item._id)).toEqual([
            'pending-child-schedule',
            'pending-later',
            'pending-unscheduled',
        ]);
    });
});
