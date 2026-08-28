import { ProfileComponent } from './profile.component';
import { of, Subject, throwError } from 'rxjs';

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

describe('ProfileComponent saved profile', () => {
    const userId = '507f1f77bcf86cd799439012';
    const originalUser = {
        _id: userId,
        name: 'Ana',
        last_name: 'Perez',
        email: 'ana@example.test',
        dni: '00112345678',
        phone: '8095550101',
        phone2: '8295550102',
        address: 'Santo Domingo',
        photo: 'https://example.test/photo.png',
        settings: [{ theme: 'light', language: 'es', notifications: true, map_marker_type: 'default' }],
    };
    let component: ProfileComponent;
    let userService: any;
    let status: any;
    let messages: any;
    let cachedProfile: any;
    let session: any;

    beforeEach(() => {
        cachedProfile = null;
        session = {
            id: userId,
            name: originalUser.name,
            dni: originalUser.dni,
            phone: originalUser.phone,
            privileges: [{ module: 'users', actions: { read: true } }],
            root: true,
        };
        spyOn(localStorage, 'getItem').and.callFake((key) => key === 'user' ? JSON.stringify(session) : null);
        spyOn(localStorage, 'setItem').and.callFake((key, value) => {
            if (key === 'user') session = JSON.parse(value);
        });
        status = jasmine.createSpyObj('StatusService', ['getState', 'setState']);
        status.getState.and.callFake(() => cachedProfile);
        status.setState.and.callFake((_key: string, value: any) => cachedProfile = value);
        userService = jasmine.createSpyObj('UserService', ['getById', 'update']);
        userService.getById.and.returnValue(of(originalUser));
        messages = jasmine.createSpyObj('MessageService', ['add']);
        component = new ProfileComponent(
            status,
            { getCurrentTheme: () => 'light', setTheme: () => {} } as any,
            { currentLang: 'es', getDefaultLang: () => 'es', use: () => {}, instant: (key: string) => key } as any,
            { setLanguage: () => {} } as any,
            { getCurrentUser: () => ({ id: userId }) } as any,
            userService,
            {} as any,
            messages,
            { detectChanges: () => {} } as any,
            {} as any,
        );
    });

    it('does not change the saved cache when editing the form', () => {
        component.ngOnInit();

        component.user.dni = '00287654321';
        component.user.settings.notifications = false;

        expect(cachedProfile.dni).toBe(originalUser.dni);
        expect(cachedProfile.settings.notifications).toBeTrue();
    });

    it('uses the confirmed response in the form, cache, session and subsequent reload', () => {
        component.ngOnInit();
        const saved = { ...originalUser, dni: '00287654321', phone: '8095550199', name: 'Ana Maria' };
        component.user.dni = ' 00287654321 ';
        component.user.phone = saved.phone;
        component.user.name = ' Ana Maria ';
        userService.update.and.returnValue(of(saved));
        const privileges = session.privileges;

        component.onSubmit();

        expect(component.user.dni).toBe(saved.dni);
        expect(component.user.name).toBe(saved.name);
        expect(cachedProfile.dni).toBe(saved.dni);
        expect(session.dni).toBe(saved.dni);
        expect(session.phone).toBe(saved.phone);
        expect(session.privileges).toEqual(privileges);
        expect(session.root).toBeTrue();
        userService.getById.and.returnValue(of(saved));
        component.ngOnInit();
        expect(component.user.dni).toBe(saved.dni);
    });

    it('does not resend an unchanged DNI or the protected email when editing another field', () => {
        component.ngOnInit();
        component.user.phone = '8095550199';
        userService.update.and.returnValue(of({ ...originalUser, phone: component.user.phone }));

        component.onSubmit();

        const payload = userService.update.calls.mostRecent().args[1];
        expect(payload.dni).toBeUndefined();
        expect(payload.email).toBeUndefined();
        expect(payload.phone).toBe('8095550199');
    });

    it('explicitly clears the optional second phone instead of omitting the edit', () => {
        component.ngOnInit();
        component.user.phone2 = ' ';
        userService.update.and.returnValue(of({ ...originalUser, phone2: undefined }));

        component.onSubmit();

        expect(userService.update.calls.mostRecent().args[1].clear_fields).toEqual(['phone2']);
        expect(component.user.phone2).toBe('');
        expect(cachedProfile.phone2).toBe('');
    });

    it('removes the photo without caching or losing other unsaved personal edits', () => {
        component.ngOnInit();
        component.user.name = 'Sin guardar';
        userService.update.and.returnValue(of({ ...originalUser, photo: undefined }));

        component.removePhoto();

        expect(userService.update.calls.mostRecent().args[1]).toEqual({ clear_fields: ['photo'] });
        expect(cachedProfile.photo).toBe('');
        expect(cachedProfile.name).toBe(originalUser.name);
        expect(component.user.name).toBe('Sin guardar');
        expect(component.userPhotoUrl).toBeNull();
    });

    it('saves settings without treating the personal form draft as persisted', () => {
        component.ngOnInit();
        component.user.dni = '00287654321';
        component.user.settings.notifications = false;
        userService.update.and.returnValue(of({
            ...originalUser,
            settings: [{ ...originalUser.settings[0], notifications: false }],
        }));

        component.onNotificationsChange({ checked: false });

        expect(cachedProfile.dni).toBe(originalUser.dni);
        expect(cachedProfile.settings.notifications).toBeFalse();
        expect(component.user.dni).toBe('00287654321');
    });

    it('shows the actual API rejection and does not cache failed edits', () => {
        component.ngOnInit();
        component.user.dni = '00287654321';
        userService.update.and.returnValue(throwError(() => ({
            status: 409,
            error: { message: 'La cédula ya está registrada en otra cuenta.', requestId: 'profile-test' },
        })));

        component.onSubmit();

        expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({
            severity: 'error',
            detail: 'La cédula ya está registrada en otra cuenta. (referencia: profile-test)',
        }));
        expect(cachedProfile.dni).toBe(originalUser.dni);
        expect(session.dni).toBe(originalUser.dni);
        expect(messages.add.calls.allArgs().some(([message]: any[]) => message.severity === 'success')).toBeFalse();
    });

    it('does not send duplicate saves while waiting for the server', () => {
        component.ngOnInit();
        const pending = new Subject<any>();
        userService.update.and.returnValue(pending);

        component.onSubmit();
        component.onSubmit();

        expect(userService.update).toHaveBeenCalledTimes(1);
        pending.next(originalUser);
        pending.complete();
        component.onSubmit();
        expect(userService.update).toHaveBeenCalledTimes(2);
    });
});
