import { DeviceLabelConfirmationService } from 'src/app/shareds/services/device-label-messages.service';
import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CloudService, CloudFile, CloudFolder } from '../../../core/services/cloud.service';
import { NotesService, Note } from '../../../core/services/notes.service';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { getApiErrorMessage } from '../../../core/utils/api-error.util';

interface CloudItem {
  id: string;
  name: string;
  type: 'folder' | 'file' | 'note';
  content?: string;
  children?: CloudItem[];
  file?: File;
  createdAt?: Date;
  createdBy?: string;
  url?: string;
  size?: number;
  mimeType?: string;
  note?: Note;
  private?: boolean;
}

@Component({
  selector: 'app-cloud',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogModule],
  templateUrl: './cloud.component.html',
  styleUrl: './cloud.component.css',
  providers: [{ provide: ConfirmationService, useClass: DeviceLabelConfirmationService }]
})
export class CloudComponent implements OnInit {
  @Input() targetId?: string;

  cloudItems: CloudItem[] = [];
  searchTerm: string = '';
  showMenu = false;
  showInfoModal = false;
  showImageViewer = false;
  showNoteModal = false;
  selectedItem: CloudItem | null = null;
  selectedImageUrl: string | null = null;
  noteTitle = '';
  noteContent = '';
  editingNoteId: string | null = null;
  isNotePrivate = false;
  isLoading = false;
  uploadProgress = 0;

  // Storage stats
  totalSize = 0;
  totalSizeFormatted = '0 MB';
  maxSize = 5.12 * 1024 * 1024 * 1024; // 5.12 GB in bytes
  maxSizeFormatted = '5.12 GB';

  constructor(
    private cloudService: CloudService,
    private notesService: NotesService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  // Check if current user is employee
  isEmployeeUser(): boolean {
    // This will be available from the AuthService after login
    // The affiliation_type_id is now stored in localStorage
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    return currentUser.affiliation_type_id === 'empleado';
  }

  ngOnInit() {
    if (this.targetId) {
      this.loadContents(this.targetId);
      this.loadStorageStats(this.targetId);
    }
  }

  ngOnChanges() {
    if (this.targetId) {
      this.loadContents(this.targetId);
      this.loadStorageStats(this.targetId);
    }
  }

  // Load contents from backend
  loadContents(targetId: string) {
    console.log('Loading contents for targetId:', targetId);
    this.isLoading = true;

    // Load both files and notes separately to handle errors gracefully
    const filePromise = this.cloudService.getFolderContents(targetId).toPromise()
      .then(response => response?.files?.map(file => this.mapFileToCloudItem(file)) || [])
      .catch(error => {
        console.error('Error loading files:', error);
        return [];
      });

    const notePromise = this.notesService.getNotes(targetId).toPromise()
      .then(notes => {
        console.log('Loaded notes:', notes);
        return notes?.map(note => this.mapNoteToCloudItem(note)) || [];
      })
      .catch(error => {
        console.error('Error loading notes:', error);
        return [];
      });

    Promise.all([filePromise, notePromise]).then(([fileItems, noteItems]) => {
      // Filter out private items if user is not employee
      const isEmployee = this.isEmployeeUser();
      const filteredFileItems = isEmployee ? fileItems : fileItems.filter(item => !item.private);
      const filteredNoteItems = isEmployee ? noteItems : noteItems.filter(item => !item.private);

      console.log('Final items:', { fileItems: filteredFileItems, noteItems: filteredNoteItems, total: [...filteredFileItems, ...filteredNoteItems] });
      this.cloudItems = [...filteredFileItems, ...filteredNoteItems];
      this.isLoading = false;
    }).catch((error) => {
      console.error('Error in loading process:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(error, 'No se pudieron cargar los contenidos del cloud')
      });
      this.isLoading = false;
    });
  }

  // Load storage stats from backend
  loadStorageStats(targetId: string) {
    this.cloudService.getStorageStats(targetId).subscribe({
      next: (stats) => {
        this.totalSize = stats.totalSize;
        this.totalSizeFormatted = this.formatFileSize(this.totalSize);
      },
      error: (error) => {
        console.error('Error loading storage stats:', error);
        // Keep default values on error
      }
    });
  }

  private mapFileToCloudItem(file: CloudFile): CloudItem {
    return {
      id: file._id,
      name: file.name,
      type: 'file',
      url: file.location_cdn,
      size: file.file_size,
      mimeType: file.mimetype,
      createdAt: new Date(file.createdAt),
      createdBy: file.owner,
      private: file.private
    };
  }

  private mapNoteToCloudItem(note: Note): CloudItem {
    return {
      id: note._id,
      name: note.title,
      type: 'note',
      content: note.content,
      createdAt: new Date(note.createdAt),
      createdBy: note.owner,
      note: note,
      private: note.private
    };
  }

  // Subir archivo
  onFileSelected(event: any, isPrivate: boolean = false) {
    const files: FileList = event.target.files;
    if (files.length === 0 || !this.targetId) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.cloudService.uploadFile(file, this.targetId!, isPrivate).subscribe({
        next: (event) => {
          // Handle upload progress if needed
          if (event.type === 1) { // HttpEventType.UploadProgress
            this.uploadProgress = Math.round(100 * event.loaded / (event.total || 1));
          }
        },
        error: (error) => {
          console.error('Error uploading file:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: `No se pudo subir el archivo ${file.name}`
          });
        },
        complete: () => {
          this.uploadProgress = 0;
          this.loadContents(this.targetId!); // Reload contents after upload
          this.loadStorageStats(this.targetId!); // Reload storage stats after upload
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: `Archivo ${file.name} subido correctamente`
          });
        }
      });
    }

    this.showMenu = false;
  }


  // Eliminar item
  deleteItem(item: CloudItem) {
    if (this.targetId) {
      const itemType = item.type === 'file' ? 'archivo' : 'nota';
      const itemName = item.name;

      this.confirmationService.confirm({
        message: `¿Estás seguro de que quieres eliminar ${item.type === 'file' ? 'el' : 'la'} ${itemType} "${itemName}"?`,
        header: 'Confirmar eliminación',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptButtonStyleClass: 'p-button-danger',
        accept: () => {
          if (item.type === 'file') {
            this.cloudService.deleteFile(item.id).subscribe({
              next: () => {
                this.loadContents(this.targetId!);
                this.loadStorageStats(this.targetId!);
                this.messageService.add({
                  severity: 'success',
                  summary: 'Éxito',
                  detail: 'Archivo eliminado correctamente'
                });
              },
              error: (error) => {
                console.error('Error deleting file:', error);
                this.messageService.add({
                  severity: 'error',
                  summary: 'Error',
                  detail: getApiErrorMessage(error, 'No se pudo eliminar el archivo')
                });
              }
            });
          } else if (item.type === 'note') {
            this.notesService.deleteNote(item.id).subscribe({
              next: () => {
                this.loadContents(this.targetId!);
                this.messageService.add({
                  severity: 'success',
                  summary: 'Éxito',
                  detail: 'Nota eliminada correctamente'
                });
              },
              error: (error) => {
                console.error('Error deleting note:', error);
                this.messageService.add({
                  severity: 'error',
                  summary: 'Error',
                  detail: getApiErrorMessage(error, 'No se pudo eliminar la nota')
                });
              }
            });
          }
        }
      });
    }
  }

  // Download file or view image
  downloadFile(item: CloudItem) {
    if (item.type === 'file' && item.url) {
      if (this.isImageFile(item.name)) {
        this.openImageViewer(item.url);
      } else {
        window.open(item.url, '_blank');
      }
    }
  }

  // Open image viewer
  openImageViewer(imageUrl: string) {
    this.selectedImageUrl = imageUrl;
    this.showImageViewer = true;
  }

  // Close image viewer
  closeImageViewer() {
    this.showImageViewer = false;
    this.selectedImageUrl = null;
  }

  // Open new note modal
  openNewNoteModal(isPrivate: boolean = false) {
    this.noteTitle = '';
    this.noteContent = '';
    this.editingNoteId = null;
    this.isNotePrivate = isPrivate;
    this.showNoteModal = true;
  }

  // Save note to database
  saveNote() {
    if (!this.noteTitle.trim() || !this.targetId) return;

    if (this.editingNoteId) {
      this.updateNote();
    } else {
      const noteData = {
        title: this.noteTitle.trim(),
        content: this.noteContent,
        owner: this.targetId,
        private: this.isNotePrivate
      };

      this.notesService.createNote(noteData).subscribe({
        next: (response) => {
          this.loadContents(this.targetId!);
          this.showNoteModal = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Nota guardada correctamente'
          });
        },
        error: (error) => {
          console.error('Error saving note:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: getApiErrorMessage(error, 'No se pudo guardar la nota')
          });
        }
      });
    }
  }

  // Edit note
  editNote(item: CloudItem) {
    if (item.type === 'note' && item.note) {
      this.noteTitle = item.note.title;
      this.noteContent = item.note.content || '';
      this.editingNoteId = item.note._id;
      this.showNoteModal = true;
    }
  }

  // Update note
  updateNote() {
    if (!this.noteTitle.trim() || !this.editingNoteId || !this.targetId) return;

    const updateData = {
      title: this.noteTitle.trim(),
      content: this.noteContent
    };

    this.notesService.updateNote(this.editingNoteId, updateData).subscribe({
      next: (response) => {
        this.loadContents(this.targetId!);
        this.showNoteModal = false;
        this.editingNoteId = null;
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Nota actualizada correctamente'
        });
      },
      error: (error) => {
        console.error('Error updating note:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: getApiErrorMessage(error, 'No se pudo actualizar la nota')
        });
      }
    });
  }

  getFilteredItems(): CloudItem[] {
    const items = this.cloudItems;
    if (!this.searchTerm.trim()) return items;
    const term = this.searchTerm.trim().toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(term));
  }

  isImageFile(name: string): boolean {
    return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name);
  }

  getImagePreview(item: CloudItem): string | undefined {
    return item.url;
  }

  toggleMenu() {
    this.showMenu = !this.showMenu;
  }

  openInfoModal(item: CloudItem) {
    this.selectedItem = item;
    this.showInfoModal = true;
  }

  editItem(item: CloudItem) {
    // Future edit functionality
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
