import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService, ConfirmationService } from 'primeng/api';
import { FilesService, FileData, CreateFileDto, UpdateFileDto } from '../../../../../../core/services/files.service';
import { FoldersService, FolderData, CreateFolderDto, UpdateFolderDto } from '../../../../../../core/services/folders.service';
import { AuthService } from '../../../../../../core/services/auth.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-montao-cloud',
  templateUrl: './montao-cloud.component.html',
  styleUrls: ['./montao-cloud.component.css'],
  standalone: false
})
export class MontaoCloudComponent implements OnInit, OnDestroy {
  @Input() target: any;

  private destroy$ = new Subject<void>();

  // Data
  folders: FolderData[] = [];
  files: FileData[] = [];
  currentFolder: FolderData | null = null;
  breadcrumb: FolderData[] = [];

  // UI State
  loading = false;
  showCreateFolderDialog = false;
  showUploadDialog = false;
  selectedFiles: File[] = [];
  newFolderName = '';
  newFolderDescription = '';
  uploadProgress = 0;
  isInitialized = false;

  // User
  currentUser: any = null;

  constructor(
    private translate: TranslateService,
    private filesService: FilesService,
    private foldersService: FoldersService,
    private authService: AuthService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();

    // Only load data if we have a valid user and haven't initialized yet
    if (this.currentUser?.id && !this.isInitialized) {
      this.isInitialized = true;
      // Add a small delay to ensure the component is fully initialized
      setTimeout(() => {
        this.loadRootFolders();
      }, 100);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  translateKey(key: string): string {
    return this.translate.instant(key);
  }

  // Folder Management
  async loadRootFolders() {
    // Prevent multiple simultaneous calls
    if (this.loading) return;

    try {
      this.loading = true;
      this.folders = await this.foldersService.getAllFolders(this.currentUser?.id);
      this.files = await this.filesService.getAllFiles(this.currentUser?.id);
      this.currentFolder = null;
      this.breadcrumb = [];
    } catch (error) {
      console.error('Error loading root folders:', error);
      // Set empty arrays to prevent undefined errors
      this.folders = [];
      this.files = [];
    } finally {
      this.loading = false;
    }
  }

  async loadFolderContents(folder: FolderData) {
    // Prevent multiple simultaneous calls
    if (this.loading) return;

    try {
      this.loading = true;
      this.currentFolder = folder;
      this.updateBreadcrumb(folder);

      // Load subfolders
      this.folders = await this.foldersService.getFoldersInside(folder._id!);

      // Load files in this folder
      this.files = await this.filesService.getFilesInFolder(this.currentUser?.id, folder._id!);
    } catch (error) {
      console.error('Error loading folder contents:', error);
      // Set empty arrays to prevent undefined errors
      this.folders = [];
      this.files = [];
    } finally {
      this.loading = false;
    }
  }

  updateBreadcrumb(folder: FolderData) {
    const index = this.breadcrumb.findIndex(f => f._id === folder._id);
    if (index >= 0) {
      this.breadcrumb = this.breadcrumb.slice(0, index + 1);
    } else {
      this.breadcrumb.push(folder);
    }
  }

  navigateToFolder(folder: FolderData) {
    this.loadFolderContents(folder);
  }

  navigateToBreadcrumb(index: number) {
    if (index === -1) {
      this.loadRootFolders();
    } else {
      this.navigateToFolder(this.breadcrumb[index]);
    }
  }

  // Create Folder
  openCreateFolderDialog() {
    this.newFolderName = '';
    this.newFolderDescription = '';
    this.showCreateFolderDialog = true;
  }

  async createFolder() {
    if (!this.newFolderName.trim()) return;

    try {
      const folderData: CreateFolderDto = {
        name: this.newFolderName,
        description: this.newFolderDescription,
        owner: this.currentUser?.id,
        creator: this.currentUser?.id,
        folder_id: this.currentFolder?._id
      };

      await this.foldersService.createFolder(folderData);

      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Folder created successfully'
      });

      this.showCreateFolderDialog = false;

      // Reload current folder contents
      if (this.currentFolder) {
        this.loadFolderContents(this.currentFolder);
      } else {
        this.loadRootFolders();
      }
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to create folder'
      });
    }
  }

  // File Upload
  openUploadDialog() {
    this.selectedFiles = [];
    this.showUploadDialog = true;
  }

  onFileSelected(event: any) {
    this.selectedFiles = Array.from(event.target.files);
  }

  async uploadFiles() {
    if (this.selectedFiles.length === 0) return;

    try {
      for (const file of this.selectedFiles) {
        const formData = new FormData();
        formData.append('files', file);
        formData.append('owner', this.currentUser?.id);
        formData.append('creator', this.currentUser?.id);
        if (this.currentFolder) {
          formData.append('folder', this.currentFolder._id!);
        }

        await this.filesService.uploadFile(formData);
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: `${this.selectedFiles.length} file(s) uploaded successfully`
      });

      this.showUploadDialog = false;

      // Reload current folder contents
      if (this.currentFolder) {
        this.loadFolderContents(this.currentFolder);
      } else {
        this.loadRootFolders();
      }
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to upload files'
      });
    }
  }

  // Delete operations
  confirmDeleteFolder(folder: FolderData) {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete the folder "${folder.name}"?`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.deleteFolder(folder)
    });
  }

  async deleteFolder(folder: FolderData) {
    try {
      await this.foldersService.deleteFolder(folder._id!);

      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Folder deleted successfully'
      });

      // Reload current folder contents
      if (this.currentFolder) {
        this.loadFolderContents(this.currentFolder);
      } else {
        this.loadRootFolders();
      }
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to delete folder'
      });
    }
  }

  confirmDeleteFile(file: FileData) {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete the file "${file.name}"?`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.deleteFile(file)
    });
  }

  async deleteFile(file: FileData) {
    try {
      await this.filesService.deleteFile(file._id!);

      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'File deleted successfully'
      });

      // Reload current folder contents
      if (this.currentFolder) {
        this.loadFolderContents(this.currentFolder);
      } else {
        this.loadRootFolders();
      }
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to delete file'
      });
    }
  }

  // Utility methods
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getFileIcon(mimetype?: string): string {
    if (!mimetype) return 'pi pi-file';
    if (mimetype.startsWith('image/')) return 'pi pi-image';
    if (mimetype.startsWith('video/')) return 'pi pi-video';
    if (mimetype.startsWith('audio/')) return 'pi pi-volume-up';
    if (mimetype.includes('pdf')) return 'pi pi-file-pdf';
    if (mimetype.includes('zip') || mimetype.includes('rar')) return 'pi pi-file';
    return 'pi pi-file';
  }

  downloadFile(file: FileData) {
    if (file.location_cdn) {
      window.open(file.location_cdn, '_blank');
    }
  }

  // Breadcrumb methods
  getBreadcrumbModel() {
    const model = [
      { label: 'Home', command: async () => { await this.loadRootFolders(); } }
    ];

    this.breadcrumb.forEach((folder, index) => {
      model.push({
        label: folder.name,
        command: async () => { await this.navigateToBreadcrumb(index); }
      });
    });

    return model;
  }

  // Context menu methods
  folderContextMenuItems: any[] = [
    {
      label: 'Open',
      icon: 'pi pi-folder-open',
      command: (event: any) => {
        const folder = event.item.data;
        this.navigateToFolder(folder);
      }
    },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      command: (event: any) => {
        const folder = event.item.data;
        this.confirmDeleteFolder(folder);
      }
    }
  ];

  fileContextMenuItems: any[] = [
    {
      label: 'Download',
      icon: 'pi pi-download',
      command: (event: any) => {
        const file = event.item.data;
        this.downloadFile(file);
      }
    },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      command: (event: any) => {
        const file = event.item.data;
        this.confirmDeleteFile(file);
      }
    }
  ];

  onFolderRightClick(event: MouseEvent, folder: FolderData) {
    event.preventDefault();
    // Update context menu data
    this.folderContextMenuItems.forEach(item => {
      item.data = folder;
    });
    // Show context menu (would need to implement with ViewChild)
  }

  onFileRightClick(event: MouseEvent, file: FileData) {
    event.preventDefault();
    // Update context menu data
    this.fileContextMenuItems.forEach(item => {
      item.data = file;
    });
    // Show context menu (would need to implement with ViewChild)
  }

  // Drag and drop methods
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    // Add visual feedback
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    // Remove visual feedback
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer?.files;
    if (files) {
      this.selectedFiles = Array.from(files);
    }
  }
}