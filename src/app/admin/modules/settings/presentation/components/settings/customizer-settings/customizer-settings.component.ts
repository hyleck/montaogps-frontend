import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Textarea } from 'primeng/inputtextarea';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

import { FormsService } from '@core/services/forms.service';
import { TagsService } from '@core/services/tags.service';
import { Form, FormField } from '@core/interfaces/form.interface';
import { Tag } from '@core/interfaces/tag.interface';

@Component({
    selector: 'app-customizer-settings',
    templateUrl: './customizer-settings.component.html',
    styleUrls: ['./customizer-settings.component.css'],
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        TableModule,
        ButtonModule,
        ToolbarModule,
        ToastModule,
        DialogModule,
        InputTextModule,
        Textarea,
        DropdownModule,
        CheckboxModule,
        ConfirmDialogModule
    ],
    providers: [MessageService, ConfirmationService]
})
export class CustomizerSettingsComponent implements OnInit {
    forms: Form[] = [];
    tags: Tag[] = [];
    loading: boolean = false;
    formDialog: boolean = false;
    submitted: boolean = false;
    form: Form = this.createEmptyForm();

    fieldTypes = [
        { label: 'Text', value: 'text' },
        { label: 'Number', value: 'number' },
        { label: 'Date', value: 'date' },
        { label: 'Boolean', value: 'boolean' }
    ];

    constructor(
        private formsService: FormsService,
        private tagsService: TagsService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) { }

    ngOnInit() {
        this.loadForms();
        this.loadTags();
    }

    createEmptyForm(): Form {
        return {
            name: '',
            description: '',
            tag: null,
            fields: []
        };
    }

    loadTags() {
        this.tagsService.getAllTags().subscribe({
            next: (data) => this.tags = data,
            error: (err) => console.error('Error loading tags', err)
        });
    }

    loadForms() {
        this.loading = true;
        this.formsService.getAllForms().subscribe({
            next: (data) => {
                this.forms = data;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading forms', err);
                this.loading = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not load forms' });
            }
        });
    }

    openNew() {
        this.form = this.createEmptyForm();
        this.submitted = false;
        this.formDialog = true;
    }

    deleteForm(form: Form) {
        if (!form._id) return;

        this.confirmationService.confirm({
            message: 'Are you sure you want to delete ' + form.name + '?',
            header: 'Confirm',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.formsService.deleteForm(form._id!).subscribe({
                    next: () => {
                        this.forms = this.forms.filter(val => val._id !== form._id);
                        this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Form Deleted', life: 3000 });
                    },
                    error: (err) => {
                        console.error('Error deleting form', err);
                        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not delete form' });
                    }
                });
            }
        });
    }

    editForm(form: Form) {
        this.form = JSON.parse(JSON.stringify(form));
        this.formDialog = true;
    }

    hideDialog() {
        this.formDialog = false;
        this.submitted = false;
    }

    saveForm() {
        this.submitted = true;

        if (this.form.name.trim()) {
            if (this.form._id) {
                this.formsService.updateForm(this.form._id, this.form).subscribe({
                    next: (updatedForm) => {
                        const index = this.forms.findIndex((f) => f._id === updatedForm._id);
                        this.forms[index] = updatedForm;
                        this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Form Updated', life: 3000 });
                        this.hideDialog();
                    },
                    error: (err) => console.error('Error updating form', err)
                });
            } else {
                this.formsService.createForm(this.form).subscribe({
                    next: (createdForm) => {
                        this.forms.push(createdForm);
                        this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Form Created', life: 3000 });
                        this.hideDialog();
                    },
                    error: (err) => console.error('Error creating form', err)
                });
            }
        }
    }

    addField() {
        this.form.fields.push({
            label: '',
            type: 'text',
            placeholder: '',
            required: false
        });
    }

    removeField(index: number) {
        this.form.fields.splice(index, 1);
    }
}
