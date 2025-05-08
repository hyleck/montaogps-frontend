import { Component } from '@angular/core';

interface CloudItem {
  id: string;
  name: string;
  type: 'folder' | 'note' | 'file';
  content?: string; // solo para notas
  children?: CloudItem[]; // solo para carpetas
  file?: File; // solo para archivos
  createdAt?: Date;
  createdBy?: string;
}

@Component({
  selector: 'app-cloud',
  standalone: false,
  templateUrl: './cloud.component.html',
  styleUrl: './cloud.component.css'
})
export class CloudComponent {
  cloudItems: CloudItem[] = [];
  currentPath: CloudItem[] = [];
  showNewFolderModal = false;
  showNewNoteModal = false;
  newFolderName = '';
  newNoteName = '';
  newNoteContent = '';
  searchTerm: string = '';
  showMenu = false;
  showInfoModal = false;
  selectedItem: CloudItem | null = null;

  // Crear carpeta
  createFolder() {
    if (!this.newFolderName.trim()) return;
    const folder: CloudItem = {
      id: Date.now() + '-folder',
      name: this.newFolderName,
      type: 'folder',
      children: [],
      createdAt: new Date(),
      createdBy: 'admin'
    };
    this.getCurrentItems().push(folder);
    this.newFolderName = '';
    this.showNewFolderModal = false;
  }

  // Crear nota
  createNote() {
    if (!this.newNoteName.trim()) return;
    const note: CloudItem = {
      id: Date.now() + '-note',
      name: this.newNoteName,
      type: 'note',
      content: this.newNoteContent,
      createdAt: new Date(),
      createdBy: 'admin'
    };
    this.getCurrentItems().push(note);
    this.newNoteName = '';
    this.newNoteContent = '';
    this.showNewNoteModal = false;
  }

  // Subir archivo
  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    for (let i = 0; i < files.length; i++) {
      const file: File = files[i];
      const fileItem: CloudItem = {
        id: Date.now() + '-file-' + i,
        name: file.name,
        type: 'file',
        file,
        createdAt: new Date(),
        createdBy: 'admin'
      };
      this.getCurrentItems().push(fileItem);
    }
  }

  // Navegar a carpeta
  enterFolder(folder: CloudItem) {
    this.currentPath.push(folder);
  }

  // Volver atrás
  goBack() {
    this.currentPath.pop();
  }

  // Eliminar item
  deleteItem(item: CloudItem) {
    const items = this.getCurrentItems();
    const idx = items.findIndex(i => i.id === item.id);
    if (idx > -1) items.splice(idx, 1);
  }

  // Obtener items de la carpeta actual
  getCurrentItems(): CloudItem[] {
    let items = this.cloudItems;
    for (const folder of this.currentPath) {
      items = folder.children!;
    }
    return items;
  }

  getFilteredItems(): CloudItem[] {
    const items = this.getCurrentItems();
    if (!this.searchTerm.trim()) return items;
    const term = this.searchTerm.trim().toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(term));
  }

  isImageFile(name: string): boolean {
    return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name);
  }

  getImagePreview(item: CloudItem): string | undefined {
    if (item.file) {
      return URL.createObjectURL(item.file);
    }
    return undefined;
  }

  toggleMenu() {
    this.showMenu = !this.showMenu;
  }

  openInfoModal(item: CloudItem) {
    this.selectedItem = item;
    this.showInfoModal = true;
  }

  editItem(item: CloudItem) {
    // Lógica de edición futura
  }
}
