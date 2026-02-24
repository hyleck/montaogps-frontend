import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { FirebaseNotificationsService } from '../../../../../../../core/services/firebase-notifications.service';
import {
  PROFILE_TYPES,
  AFFILIATION_TYPES,
  COMPANY_TYPES,
  ProfileTypeOption,
  AffiliationTypeOption,
  CompanyTypeOption
} from 'src/app/admin/modules/management/presentation/components/management/user-form/constants/user-form.constants';

@Component({
  selector: 'app-push-manager-settings',
  standalone: false,
  templateUrl: './push-manager-settings.component.html',
  styleUrl: './push-manager-settings.component.css'
})
export class PushManagerSettingsComponent implements OnInit {
  pushForm!: FormGroup;
  isSending: boolean = false;

  profileTypes: ProfileTypeOption[] = PROFILE_TYPES;
  affiliationTypes: AffiliationTypeOption[] = AFFILIATION_TYPES;
  companyTypes: CompanyTypeOption[] = COMPANY_TYPES;

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private firebaseNotificationsService: FirebaseNotificationsService
  ) { }

  ngOnInit() {
    this.pushForm = this.fb.group({
      title: ['', Validators.required],
      body: ['', Validators.required],
      profileTypes: [''],
      affiliationTypes: [''],
      companyTypes: ['']
    });
  }

  sendPush() {
    if (this.pushForm.invalid) {
      this.pushForm.markAllAsTouched();
      return;
    }

    this.isSending = true;

    // Cast the single-select string values into arrays for the backend DTO if they are not empty
    const rawData = this.pushForm.value;
    const data = {
      title: rawData.title,
      body: rawData.body,
      profileTypes: rawData.profileTypes ? [rawData.profileTypes] : [],
      affiliationTypes: rawData.affiliationTypes ? [rawData.affiliationTypes] : [],
      companyTypes: rawData.companyTypes ? [rawData.companyTypes] : []
    };

    this.firebaseNotificationsService.sendMassNotification(data).subscribe({
      next: (response) => {
        this.isSending = false;
        if (response.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: `Notificación enviada a ${response.sentCount} usuarios. (Errores: ${response.errorCount})`,
            life: 5000
          });
          this.pushForm.reset();
        }
      },
      error: (err) => {
        this.isSending = false;
        console.error('Error enviando notificación masiva:', err);
        const errorDetail = err.error?.message || 'No se pudo enviar la notificación masiva o usted no tiene permisos root.';

        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorDetail,
          life: 5000
        });
      }
    });
  }
}
