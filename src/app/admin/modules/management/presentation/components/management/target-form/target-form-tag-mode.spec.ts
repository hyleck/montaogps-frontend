import { TargetFormComponent } from './target-form.component';

describe('TargetFormComponent tag vehicle form mode', () => {
    const buildComponent = (protocolName: string, isAirtag = true) => {
        const component = Object.create(
            TargetFormComponent.prototype,
        ) as TargetFormComponent;

        Object.assign(component as any, {
            selectedProtocol: { name: protocolName, isAirtag },
            target: {
                _id: '',
                name: 'Vehículo de prueba',
                target_category: 'vehicle',
                target_brand_id: 'brand-1',
                target_model_id: 'model-1',
                target_year: '2024',
                target_color: '#ffffff',
                target_plate_number: 'ABC123',
                target_chassis_number: 'CHASSIS-123',
                target_image: 'vehicle.jpg',
                target_image_thumbnail: 'vehicle-thumb.jpg',
                engine_shutdown: '',
                ignition_sensor: '',
                gps_adicional: '',
                status: 'active',
            },
            managementService: {
                getCurrentUserId: () => 'user-1',
            },
        });

        return component;
    };

    it('shows the normal vehicle form for MTAG-A without requiring a SIM card', () => {
        const component = buildComponent('MTAG-A');

        expect(component.usesBasicTargetForm()).toBeFalse();
        expect(component.isTagTarget()).toBeTrue();
        expect(component.requiresSimCard()).toBeFalse();
    });

    it('keeps the basic objective form only for MTAG-P', () => {
        const component = buildComponent('MTAG-P');

        expect(component.usesBasicTargetForm()).toBeTrue();
        expect(component.isTagTarget()).toBeTrue();
        expect(component.requiresSimCard()).toBeFalse();
    });

    it('preserves vehicle data when saving an MTAG-A', () => {
        const component = buildComponent('MTAG-A');

        const data = (component as any).prepareTargetData();

        expect(data.target_brand_id).toBe('brand-1');
        expect(data.target_model_id).toBe('model-1');
        expect(data.target_plate_number).toBe('ABC123');
        expect(data.target_chassis_number).toBe('CHASSIS-123');
    });

    it('removes vehicle-only data when saving an MTAG-P', () => {
        const component = buildComponent('MTAG-P');

        const data = (component as any).prepareTargetData();

        expect(data.target_brand_id).toBe('');
        expect(data.target_model_id).toBe('');
        expect(data.target_plate_number).toBe('');
        expect(data.target_chassis_number).toBe('');
    });
});
