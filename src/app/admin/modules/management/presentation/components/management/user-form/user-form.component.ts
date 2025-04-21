import { Component } from '@angular/core';

interface UserPrivilege {
    module: string;
    actions: {
        create: boolean;
        read: boolean;
        update: boolean;
        delete: boolean;
    };
}

interface UserSettings {
    theme: string;
    notifications: boolean;
    language: string;
}

interface User {
    email: string;
    password: string;
    name: string;
    last_name: string;
    dni: string;
    birth: string;
    address: string;
    photo: string;
    phone: string;
    phone2: string;
    verified_email: boolean;
    hashdRt: string;
    parent_id: string;
    conversation_id: number;
    creator_id: string;
    last_login: string;
    index: string;
    privileges: UserPrivilege[];
    settings: UserSettings[];
    access_level_id: string;
    profile_type_id: string;
    affiliation_type_id: string;
    department_id: string;
}

@Component({
    selector: 'app-user-form',
    templateUrl: './user-form.component.html',
    styleUrls: ['./user-form.component.css'],
    standalone: false
})
export class UserFormComponent {
    user: User = {
        email: '',
        password: '',
        name: '',
        last_name: '',
        dni: '',
        birth: '',
        address: '',
        photo: '',
        phone: '',
        phone2: '',
        verified_email: false,
        hashdRt: '',
        parent_id: '',
        conversation_id: 0,
        creator_id: '',
        last_login: '',
        index: '',
        privileges: [{
            module: '',
            actions: {
                create: false,
                read: false,
                update: false,
                delete: false
            }
        }],
        settings: [{
            theme: 'light',
            notifications: true,
            language: 'es'
        }],
        access_level_id: '',
        profile_type_id: '',
        affiliation_type_id: '',
        department_id: ''
    };

    modules = [
        { label: 'Usuarios', value: 'users' },
        { label: 'Objetivos', value: 'targets' },
        { label: 'Reportes', value: 'reports' },
        { label: 'Configuración', value: 'settings' }
    ];

    themes = [
        { label: 'Claro', value: 'light' },
        { label: 'Oscuro', value: 'dark' }
    ];

    languages = [
        { label: 'Español', value: 'es' },
        { label: 'Inglés', value: 'en' }
    ];

    constructor() {}

    onSubmit() {
        console.log('Usuario:', this.user);
    }

    onSavePrivileges() {
        console.log('Privilegios actualizados:', this.user.privileges);
    }

    onSaveSettings() {
        console.log('Configuración actualizada:', this.user.settings);
    }
}
