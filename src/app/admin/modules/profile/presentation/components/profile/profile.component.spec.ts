import { ProfileComponent } from './profile.component';

describe('ProfileComponent self update payload', () => {
    it('allows phone changes without sending the protected email field', () => {
        const component = Object.create(
            ProfileComponent.prototype,
        ) as ProfileComponent;

        component.user = {
            name: ' Frankely ',
            last_name: ' Garcia ',
            email: 'frankely@example.com',
            phone: ' 8095550101 ',
            phone2: ' 8295550102 ',
            dni: ' 00112345678 ',
            address: ' Santo Domingo ',
            auto_response: false,
            settings: {
                theme: 'light',
                language: 'es',
                notifications: true,
                map_marker_type: 'default',
            },
        };

        const payload = (component as any).prepareUpdateUserDto();

        expect(payload.email).toBeUndefined();
        expect(payload.phone).toBe('8095550101');
        expect(payload.phone2).toBe('8295550102');
    });
});
