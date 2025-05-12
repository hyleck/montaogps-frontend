import { Component, OnInit } from '@angular/core';
import { ColorsService } from 'src/app/core/services/colors.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

interface Color {
  _id?: string;
  nombre: string;
  hex: string;
}

@Component({
  selector: 'app-colors-settings',
  standalone: false,
  templateUrl: './colors-settings.component.html',
  styleUrl: './colors-settings.component.css'
})
export class ColorsSettingsComponent implements OnInit {
  colors: Color[] = [];
  loading = false;
  isEditing = false;
  selectedColor: Color | null = null;
  colorForm: Color = {
    nombre: '',
    hex: '#ffffff'
  };
  showColorForm = false;

  constructor(
    private colorsService: ColorsService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private translate: TranslateService
  ) { }

  ngOnInit(): void {
    this.loadColors();
  }

  async loadColors() {
    try {
      this.loading = true;
      this.colors = await this.colorsService.getAllColors();
    } catch (error) {
      console.error('Error al cargar los colores:', error);
      this.showErrorMessage('error_loading');
    } finally {
      this.loading = false;
    }
  }

  openNewColorForm() {
    this.isEditing = false;
    this.colorForm = {
      nombre: '',
      hex: '#ffffff'
    };
    this.showColorForm = true;
  }

  editColor(color: Color) {
    this.isEditing = true;
    this.selectedColor = color;
    this.colorForm = {
      ...color
    };
    this.showColorForm = true;
  }

  async saveColor() {
    try {
      this.loading = true;
      if (this.isEditing && this.selectedColor?._id) {
        // Actualizar color existente
        await this.colorsService.updateColor(this.selectedColor._id, this.colorForm);
        this.showSuccessMessage('color_updated', this.colorForm.nombre);
      } else {
        // Crear nuevo color
        await this.colorsService.createColor(this.colorForm);
        this.showSuccessMessage('color_created', this.colorForm.nombre);
      }
      // Recargar colores y resetear formulario
      await this.loadColors();
      this.cancelEdit();
    } catch (error) {
      console.error('Error al guardar el color:', error);
      this.showErrorMessage(this.isEditing ? 'error_update' : 'error_create');
    } finally {
      this.loading = false;
    }
  }

  deleteColor(color: Color) {
    if (!color._id) return;

    const message = `¿Está seguro que desea eliminar el color "${color.nombre}"?`;
    const header = 'Confirmar eliminación';
    
    this.confirmationService.confirm({
      message: message,
      header: header,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'No, cancelar',
      accept: async () => {
        try {
          this.loading = true;
          await this.colorsService.deleteColor(color._id!);
          this.showSuccessMessage('color_deleted', color.nombre);
          await this.loadColors();
        } catch (error) {
          console.error('Error al eliminar el color:', error);
          this.showErrorMessage('error_delete');
        } finally {
          this.loading = false;
        }
      }
    });
  }

  cancelEdit() {
    this.isEditing = false;
    this.selectedColor = null;
    this.showColorForm = false;
    this.colorForm = {
      nombre: '',
      hex: '#ffffff'
    };
  }

  private showSuccessMessage(key: string, nombre: string) {
    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: `Color "${nombre}" ${key === 'color_created' ? 'creado' : key === 'color_updated' ? 'actualizado' : 'eliminado'} correctamente.`
    });
  }

  private showErrorMessage(key: string) {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: key === 'error_loading' ? 'Error al cargar los colores' :
              key === 'error_create' ? 'Error al crear el color' :
              key === 'error_update' ? 'Error al actualizar el color' : 'Error al eliminar el color'
    });
  }
}
