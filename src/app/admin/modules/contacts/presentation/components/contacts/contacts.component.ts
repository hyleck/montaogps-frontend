import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ContactsService, Contact, CreateContactDto } from '../../../../../../core/services/contacts.service';

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.component.html',
  styleUrls: ['./contacts.component.css'],
  standalone: false
})
export class ContactsComponent implements OnChanges {
  @Input() referenceId: string | null = null;

  contacts: Contact[] = [];
  loading = false;
  saving = false;
  error: string | null = null;
  editingId: string | null = null;
  showForm = false;
  relationshipOptions: string[] = [
    'Padre/Madre',
    'Hijo/Hija',
    'Esposo/a',
    'Hermano/a',
    'Tío/a',
    'Abuelo/a',
    'Nieto/a',
    'Amigo/a',
    'Dueño/a del vehículo',
    'Tutor', 'Conductor',
    'Contacto de emergencia',
    'Otro'
  ];

  form: CreateContactDto = {
    full_name: '',
    phone: '',
    relationship: '',
    observation: '',
    reference: ''
  };

  constructor(private contactsService: ContactsService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['referenceId'] && this.referenceId) {
      this.form.reference = this.referenceId;
      this.showForm = false;
      this.editingId = null;
      this.loadContacts();
    }
  }

  async loadContacts(): Promise<void> {
    if (!this.referenceId) return;
    this.loading = true;
    this.error = null;
    this.contactsService.getAll(this.referenceId).subscribe({
      next: (data) => {
        this.contacts = data || [];
        this.loading = false;
        if (this.contacts.length === 0) {
          this.resetForm();
          this.showForm = true;
        } else {
          this.showForm = false;
        }
      },
      error: (err) => {
        console.error('Error loading contacts', err);
        this.error = 'No se pudieron cargar los contactos';
        this.loading = false;
      }
    });
  }

  edit(contact: Contact): void {
    if (!contact._id) return;
    this.editingId = contact._id;
    this.form = {
      full_name: contact.full_name,
      phone: contact.phone,
      relationship: contact.relationship,
      observation: contact.observation || '',
      reference: this.referenceId || contact.reference || '',
    };
    this.showForm = true;
  }

  save(): void {
    if (!this.referenceId) return;
    if (!this.form.full_name?.trim() || !this.form.phone?.trim() || !this.form.relationship?.trim()) {
      this.error = 'Completa los campos requeridos';
      return;
    }
    this.saving = true;
    this.error = null;

    if (this.editingId) {
      this.contactsService.update(this.editingId, this.form).subscribe({
        next: () => {
          this.loadContacts();
          this.resetForm();
          this.showForm = false;
          this.saving = false;
        },
        error: (err) => {
          console.error('Error updating contact', err);
          this.error = 'No se pudo actualizar el contacto';
          this.saving = false;
        }
      });
    } else {
      this.contactsService.create(this.form).subscribe({
        next: (_created) => {
          this.loadContacts();
          this.resetForm();
          this.showForm = false;
          this.saving = false;
        },
        error: (err) => {
          console.error('Error saving contact', err);
          this.error = 'No se pudo guardar el contacto';
          this.saving = false;
        }
      });
    }
  }

  delete(contact: Contact): void {
    if (!contact._id) return;
    const shouldDelete = confirm(`¿Eliminar el contacto ${contact.full_name}?`);
    if (!shouldDelete) return;

    this.contactsService.delete(contact._id).subscribe({
      next: () => {
        this.contacts = this.contacts.filter(c => c._id !== contact._id);
      },
      error: (err) => {
        console.error('Error deleting contact', err);
        this.error = 'No se pudo eliminar el contacto';
      }
    });
  }

  cancelEdit(): void {
    this.resetForm();
    this.showForm = false;
  }

  private resetForm(): void {
    this.form = { full_name: '', phone: '', relationship: '', observation: '', reference: this.referenceId || '' };
    this.editingId = null;
    this.error = null;
  }

  openNew(): void {
    this.resetForm();
    this.showForm = true;
  }
}
