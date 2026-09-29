import { TargetFormComponent } from './target-form.component';
import { TargetStatusResponse } from 'src/app/core/services/targets.service';

describe('TargetFormComponent renewal dates and invoice refresh', () => {
    function build() {
        const component = Object.create(TargetFormComponent.prototype) as TargetFormComponent;
        component.target = { _id: 'gps-1', name: 'Borrador del vehículo', expiration_date: '2025-09-28',
            pending_renewal_date: '2027-09-28', pending_renewal_process_id: 'process-1' } as any;
        component.processForm = { type: 'cash_renewal', renewalYears: null, newRenewalDate: '2025-09-28', description: 'Observación sin guardar' } as any;
        (component as any).lastServerExpirationDate = '2025-09-28';
        return component;
    }

    function selectYears(component: TargetFormComponent, years: number) {
        component.processForm.renewalYears = years;
        component.onRenewalYearsChange();
    }

    it('calculates the selected years once when switching 1 to 2, repeating 2 and returning to 1', () => {
        const component = build();
        selectYears(component, 1);
        expect(component.processForm.newRenewalDate).toBe('2026-09-28');
        selectYears(component, 2);
        expect(component.processForm.newRenewalDate).toBe('2027-09-28');
        selectYears(component, 2);
        expect(component.processForm.newRenewalDate).toBe('2027-09-28');
        selectYears(component, 1);
        expect(component.processForm.newRenewalDate).toBe('2026-09-28');
    });

    it('preserves a manual date adjustment and changes only the difference in selected years', () => {
        const component = build();
        selectYears(component, 2);
        component.processForm.newRenewalDate = '2028-11-15';
        selectYears(component, 3);
        expect(component.processForm.newRenewalDate).toBe('2029-11-15');
        selectYears(component, 2);
        expect(component.processForm.newRenewalDate).toBe('2028-11-15');
    });

    it('keeps the original leap-day anchor while changing years', () => {
        const component = build();
        component.target.expiration_date = '2024-02-29';
        component.processForm.newRenewalDate = '2024-02-29';
        selectYears(component, 1);
        expect(component.processForm.newRenewalDate).toBe('2025-02-28');
        selectYears(component, 4);
        expect(component.processForm.newRenewalDate).toBe('2028-02-29');
    });

    it('starts a new calculation from the current device when the process type changes', () => {
        const component = build();
        selectYears(component, 2);
        spyOn(console, 'log');
        component.processForm.type = 'renewal';
        component.onProcessTypeChange();
        selectYears(component, 1);
        expect(component.processForm.newRenewalDate).toBe('2026-09-28');
    });

    it('does not shift or mutate an invalid date', () => {
        const component = build();
        component.processForm.newRenewalDate = 'invalid';
        selectYears(component, 2);
        expect(component.processForm.newRenewalDate).toBe('invalid');
    });

    const applied: TargetStatusResponse = { _id: 'gps-1', device_imei: '111', expiration_date: '2027-09-28T00:00:00.000Z',
        pending_renewal_date: null, pending_renewal_process_id: null, pending_renewal_requested_at: null };

    it('refreshes the paid expiration and clears pending fields without resetting other draft values', () => {
        const component = build();
        const draft = { ...component.processForm };
        component.applyRenewalStatus(applied);
        expect(component.target.expiration_date).toBe('2027-09-28');
        expect(component.target.pending_renewal_process_id).toBeNull();
        expect(component.target.pending_renewal_date).toBeNull();
        expect(component.target.name).toBe('Borrador del vehículo');
        expect(component.processForm).toEqual(draft);
        component.applyRenewalStatus({ ...applied, expiration_date: '2028-09-28T04:00:00.000Z' });
        expect(component.target.expiration_date).toBe('2028-09-28');
    });

    it('preserves an unsaved expiration edit while clearing pending invoice fields', () => {
        const component = build();
        component.target.expiration_date = '2030-01-10';
        component.applyRenewalStatus(applied);
        component.applyRenewalStatus(applied);
        expect(component.target.expiration_date).toBe('2030-01-10');
        expect(component.target.pending_renewal_process_id).toBeNull();
    });

    it('ignores responses for another device and absent fields from older APIs', () => {
        const component = build();
        const before = { ...component.target };
        component.applyRenewalStatus({ ...applied, _id: 'gps-2' });
        component.applyRenewalStatus({ _id: 'gps-1', device_imei: '111' });
        expect(component.target).toEqual(before);
    });
});
