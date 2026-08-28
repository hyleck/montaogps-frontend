import { DeviceLabelConfirmationService, DeviceLabelMessageService } from 'src/app/shareds/services/device-label-messages.service';
import { Component, OnInit } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { TextareaModule } from 'primeng/textarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { MembresiasService } from '@core/services/membresias.service';
import { Membresia, Oferta } from '@core/interfaces/membresia.interface';
import { getApiErrorMessage } from '../../../../../../../core/utils/api-error.util';

@Component({
    selector: 'app-membresias-settings',
    templateUrl: './membresias-settings.component.html',
    styleUrls: ['./membresias-settings.component.css'],
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        TableModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        FormsModule,
        ConfirmDialogModule,
        ToastModule,
        ToolbarModule,
        TextareaModule,
        InputNumberModule
    ],
    providers: [{ provide: ConfirmationService, useClass: DeviceLabelConfirmationService }, { provide: MessageService, useClass: DeviceLabelMessageService }]
})
export class MembresiasSettingsComponent implements OnInit {
    membresias: Membresia[] = [];
    membresiaDialog: boolean = false;
    membresia: Membresia = this.getEmptyMembresia();
    submitted: boolean = false;
    isEditing: boolean = false;
    loading: boolean = false;
    newOferta: Oferta = { name: '', description: '', discount_percentage: 0, promotional_price: 0 };

    constructor(
        private membresiasService: MembresiasService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
        private translate: TranslateService
    ) { }

    ngOnInit() {
        this.loadMembresias();
    }

    private getEmptyMembresia(): Membresia {
        return {
            name: '',
            description: '',
            duration_type: 'mensual',
            price: 0,
            currency: 'USD',
            active: true,
            ofertas: []
        };
    }

    loadMembresias() {
        this.loading = true;
        this.membresiasService.getAll().subscribe({
            next: (membresias) => {
                this.membresias = membresias;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading membresias:', err);
                this.loading = false;
            }
        });
    }

    openNew() {
        this.membresia = this.getEmptyMembresia();
        this.submitted = false;
        this.membresiaDialog = true;
        this.isEditing = false;
    }

    editMembresia(membresia: Membresia) {
        this.membresia = { ...membresia, ofertas: membresia.ofertas ? [...membresia.ofertas] : [] };
        this.membresiaDialog = true;
        this.isEditing = true;
    }

    deleteMembresia(membresia: Membresia) {
        this.confirmationService.confirm({
            message: `¿Está seguro que desea eliminar la membresía "${membresia.name}"?`,
            header: 'Confirmar eliminación',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                if (membresia._id) {
                    this.membresiasService.delete(membresia._id).subscribe({
                        next: () => {
                            this.membresias = this.membresias.filter(m => m._id !== membresia._id);
                            this.messageService.add({
                                severity: 'success',
                                summary: 'Éxito',
                                detail: 'Membresía eliminada',
                                life: 3000
                            });
                        },
                        error: (err) => {
                            console.error('Error deleting membresia:', err);
                            this.messageService.add({
                                severity: 'error',
                                summary: 'Error',
                                detail: getApiErrorMessage(err, 'No se pudo eliminar la membresía')
                            });
                        }
                    });
                }
            }
        });
    }

    hideDialog() {
        this.membresiaDialog = false;
        this.submitted = false;
    }

    saveMembresia() {
        this.submitted = true;

        if (this.membresia.name.trim() && this.membresia.price >= 0) {
            if (this.isEditing && this.membresia._id) {
                this.membresiasService.update(this.membresia._id, this.membresia).subscribe({
                    next: (updated) => {
                        const index = this.membresias.findIndex(m => m._id === updated._id);
                        if (index !== -1) {
                            this.membresias[index] = updated;
                        }
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Éxito',
                            detail: 'Membresía actualizada',
                            life: 3000
                        });
                        this.membresiaDialog = false;
                        this.membresia = this.getEmptyMembresia();
                    },
                    error: (err) => {
                        console.error('Error updating membresia:', err);
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: getApiErrorMessage(err, 'No se pudo actualizar la membresía')
                        });
                    }
                });
            } else {
                this.membresiasService.create(this.membresia).subscribe({
                    next: (created) => {
                        this.membresias.push(created);
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Éxito',
                            detail: 'Membresía creada',
                            life: 3000
                        });
                        this.membresiaDialog = false;
                        this.membresia = this.getEmptyMembresia();
                    },
                    error: (err) => {
                        console.error('Error creating membresia:', err);
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: getApiErrorMessage(err, 'No se pudo crear la membresía')
                        });
                    }
                });
            }
        }
    }

    addOferta() {
        if (this.newOferta.name.trim()) {
            this.membresia.ofertas.push({ ...this.newOferta });
            this.newOferta = { name: '', description: '', discount_percentage: 0, promotional_price: 0 };
        }
    }

    onPromoPriceChange() {
        if (this.membresia.price > 0 && this.newOferta.promotional_price >= 0) {
            const discount = ((this.membresia.price - this.newOferta.promotional_price) / this.membresia.price) * 100;
            this.newOferta.discount_percentage = Math.max(0, Math.round(discount * 100) / 100);
        }
    }

    removeOferta(index: number) {
        this.membresia.ofertas.splice(index, 1);
    }
}
