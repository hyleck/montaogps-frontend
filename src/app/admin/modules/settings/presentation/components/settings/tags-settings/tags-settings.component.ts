import { Component, OnInit } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Tag } from '@core/interfaces/tag.interface';
import { TagsService } from '@core/services/tags.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ColorPickerModule } from 'primeng/colorpicker';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { TextareaModule } from 'primeng/textarea';

@Component({
    selector: 'app-tags-settings',
    templateUrl: './tags-settings.component.html',
    styleUrls: ['./tags-settings.component.css'],
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        TableModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        ColorPickerModule,
        FormsModule,
        ConfirmDialogModule,
        ToastModule,
        ToolbarModule,
        TextareaModule
    ],
    providers: [ConfirmationService, MessageService]
})
export class TagsSettingsComponent implements OnInit {
    tags: Tag[] = [];
    tagDialog: boolean = false;
    tag: Tag = { name: '', description: '', color: '#000000' };
    submitted: boolean = false;
    isEditing: boolean = false;

    constructor(
        private tagsService: TagsService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
        private translate: TranslateService
    ) { }

    ngOnInit() {
        this.loadTags();
    }

    loadTags() {
        this.tagsService.getAllTags().subscribe({
            next: (tags) => (this.tags = tags),
            error: (error) => console.error('Error loading tags:', error)
        });
    }

    openNew() {
        this.tag = { name: '', description: '', color: '#000000' };
        this.submitted = false;
        this.tagDialog = true;
        this.isEditing = false;
    }

    editTag(tag: Tag) {
        this.tag = { ...tag };
        this.tagDialog = true;
        this.isEditing = true;
    }

    deleteTag(tag: Tag) {
        this.confirmationService.confirm({
            message: this.translate.instant('settings.tags.confirm_delete', { name: tag.name }),
            header: 'Confirm',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                if (tag._id) {
                    this.tagsService.deleteTag(tag._id).subscribe({
                        next: () => {
                            this.tags = this.tags.filter((val) => val._id !== tag._id);
                            this.tag = { name: '', description: '', color: '#000000' };
                            this.messageService.add({
                                severity: 'success',
                                summary: 'Successful',
                                detail: 'Tag Deleted',
                                life: 3000
                            });
                        },
                        error: (error) => {
                            console.error('Error deleting tag:', error);
                            this.messageService.add({
                                severity: 'error',
                                summary: 'Error',
                                detail: 'Error deleting tag'
                            });
                        }
                    });
                }
            }
        });
    }

    hideDialog() {
        this.tagDialog = false;
        this.submitted = false;
    }

    saveTag() {
        this.submitted = true;

        if (this.tag.name.trim()) {
            if (this.tag._id) {
                this.tagsService.updateTag(this.tag._id, this.tag).subscribe({
                    next: (updatedTag) => {
                        const index = this.tags.findIndex((t) => t._id === updatedTag._id);
                        if (index !== -1) {
                            this.tags[index] = updatedTag;
                        }
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Successful',
                            detail: 'Tag Updated',
                            life: 3000
                        });
                        this.tagDialog = false;
                        this.tag = { name: '', description: '', color: '#000000' };
                    },
                    error: (error) => {
                        console.error('Error updating tag:', error);
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: 'Error updating tag'
                        });
                    }
                });
            } else {
                this.tagsService.createTag(this.tag).subscribe({
                    next: (createdTag) => {
                        this.tags.push(createdTag);
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Successful',
                            detail: 'Tag Created',
                            life: 3000
                        });
                        this.tagDialog = false;
                        this.tag = { name: '', description: '', color: '#000000' };
                    },
                    error: (error) => {
                        console.error('Error creating tag:', error);
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: 'Error creating tag'
                        });
                    }
                });
            }
        }
    }
}
