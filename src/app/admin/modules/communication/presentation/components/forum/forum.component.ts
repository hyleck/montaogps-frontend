import { Component, OnInit, OnDestroy } from '@angular/core';
import { ForumService, ForumCategory, ForumTopic, ForumPost } from '../../../../../../core/services/forum.service';
import { AuthService } from '../../../../../../core/services/auth.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { getApiErrorMessage } from '../../../../../../core/utils/api-error.util';

@Component({
  selector: 'app-forum',
  templateUrl: './forum.component.html',
  styleUrls: ['./forum.component.scss'],
  standalone: false
})
export class ForumComponent implements OnInit, OnDestroy {
  currentUser: any;
  view: 'categories' | 'topics' | 'thread' = 'categories';

  // Categories
  categories: ForumCategory[] = [];
  loadingCategories = false;
  selectedCategory: ForumCategory | null = null;
  showNewCategoryModal = false;
  newCategoryForm = { name: '', description: '', icon: 'pi pi-folder' };

  // Topics
  topics: ForumTopic[] = [];
  loadingTopics = false;
  selectedTopic: ForumTopic | null = null;
  showNewTopicModal = false;
  newTopicForm = { title: '', content: '' };

  // Posts
  posts: ForumPost[] = [];
  loadingPosts = false;
  replyContent = '';
  submittingReply = false;

  constructor(
    private forumService: ForumService,
    private authService: AuthService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadCategories();
  }

  ngOnDestroy(): void {}

  // --- Views ---
  goToCategories() {
    this.view = 'categories';
    this.selectedCategory = null;
    this.selectedTopic = null;
    this.loadCategories();
  }

  goToTopics(category: ForumCategory) {
    this.selectedCategory = category;
    this.view = 'topics';
    this.loadTopics();
  }

  goToThread(topic: ForumTopic) {
    this.selectedTopic = topic;
    this.view = 'thread';
    this.loadThread();
  }

  // --- Utility ---
  isRootUser(): boolean {
    return this.currentUser?.root === true;
  }

  getTimeAgo(dateInput: string | Date | undefined): string {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '—';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    const intervals = [
      { label: 'año', seconds: 31536000 },
      { label: 'mes', seconds: 2592000 },
      { label: 'día', seconds: 86400 },
      { label: 'hora', seconds: 3600 },
      { label: 'minuto', seconds: 60 },
      { label: 'segundo', seconds: 1 }
    ];
    for (const i of intervals) {
      const count = Math.floor(seconds / i.seconds);
      if (count >= 1) {
        return `hace ${count} ${i.label}${count !== 1 && !i.label.endsWith('s') && !i.label.endsWith('z') ? 's' : (count !== 1 && i.label==='mes' ? 'es' : '')}`;
      }
    }
    return 'hace un momento';
  }

  // --- Categories API ---
  loadCategories() {
    this.loadingCategories = true;
    this.forumService.getCategories().subscribe({
      next: (data: any) => {
        this.categories = data;
        this.loadingCategories = false;
      },
      error: (err: any) => {
        this.loadingCategories = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(err, 'No se pudieron cargar las categorías') });
      }
    });
  }

  openNewCategoryModal() {
    this.newCategoryForm = { name: '', description: '', icon: 'pi pi-folder' };
    this.showNewCategoryModal = true;
  }

  saveCategory() {
    if (!this.newCategoryForm.name) return;
    this.forumService.createCategory(this.newCategoryForm).subscribe({
      next: () => {
        this.showNewCategoryModal = false;
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Categoría creada' });
        this.loadCategories();
      },
      error: (err: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(err, 'Ocurrió un problema creando la categoría') });
      }
    });
  }

  // --- Topics API ---
  loadTopics() {
    if (!this.selectedCategory) return;
    this.loadingTopics = true;
    this.forumService.getTopicsByCategory(this.selectedCategory._id).subscribe({
      next: (data: any) => {
        this.topics = data;
        this.loadingTopics = false;
      },
      error: (err: any) => {
        this.loadingTopics = false;
      }
    });
  }

  openNewTopicModal() {
    this.newTopicForm = { title: '', content: '' };
    this.showNewTopicModal = true;
  }

  saveTopic() {
    if (!this.newTopicForm.title || !this.newTopicForm.content || !this.selectedCategory) return;
    const payload = {
      categoryId: this.selectedCategory._id,
      title: this.newTopicForm.title,
      content: this.newTopicForm.content
    };
    this.forumService.createTopic(payload).subscribe({
      next: (topic: any) => {
        this.showNewTopicModal = false;
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Tema creado exitosamente' });
        this.goToThread(topic); // Auto navigate to topic
      },
      error: (err: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(err, 'Ocurrió un problema creando el tema') });
      }
    });
  }

  // --- Thread API ---
  loadThread() {
    if (!this.selectedTopic) return;
    this.loadingPosts = true;
    
    // Increment views and get topic
    this.forumService.getTopicDetail(this.selectedTopic._id).subscribe({
      next: (topicWithAuthor: any) => {
        this.selectedTopic = topicWithAuthor; // Refreshed with author data and view count

        // Load posts
        this.forumService.getPostsByTopic(this.selectedTopic!._id).subscribe({
          next: (posts: any) => {
            this.posts = posts;
            this.loadingPosts = false;
          },
          error: (err: any) => this.loadingPosts = false
        });
      },
      error: (err: any) => this.loadingPosts = false
    });
  }

  submitReply() {
    if (!this.replyContent.trim() || !this.selectedTopic) return;
    this.submittingReply = true;
    const payload = {
      topicId: this.selectedTopic._id,
      content: this.replyContent.trim() // Will convert later to markdown rendering safely
    };
    
    this.forumService.createPost(payload).subscribe({
      next: (post: any) => {
        this.replyContent = '';
        this.submittingReply = false;
        this.loadThread(); // Reload fully
      },
      error: (err: any) => {
        this.submittingReply = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(err, 'No se pudo publicar la respuesta') });
      }
    });
  }

  toggleLikeTopic() {
    if (!this.selectedTopic) return;
    this.forumService.toggleTopicLike(this.selectedTopic._id).subscribe({
      next: (updated: any) => {
        this.selectedTopic!.likes = updated.likes;
      },
      error: (err: any) => {}
    });
  }

  toggleLikePost(post: ForumPost) {
    this.forumService.togglePostLike(post._id).subscribe({
      next: (updated: any) => {
        post.likes = updated.likes;
      },
      error: (err: any) => {}
    });
  }

  hasLiked(item: { likes: string[] }): boolean {
    if (!this.currentUser || !item.likes) return false;
    return item.likes.includes(this.currentUser.id || this.currentUser._id);
  }

  isOwner(authorId: string): boolean {
    if (!this.currentUser) return false;
    return authorId === (this.currentUser.id || this.currentUser._id);
  }

  // --- DELETE ---
  deleteCategory(cat: ForumCategory, event: Event) {
    event.stopPropagation();
    this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar la categoría "${cat.name}"? Esto eliminará todos los temas y respuestas dentro de ella.`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-trash',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.forumService.deleteCategory(cat._id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Categoría eliminada' });
            this.loadCategories();
          },
          error: (err: any) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(err, 'No se pudo eliminar') });
          }
        });
      }
    });
  }

  deleteTopic(topic: ForumTopic, event: Event) {
    event.stopPropagation();
    this.confirmationService.confirm({
      message: `¿Eliminar el tema "${topic.title}" y todas sus respuestas?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-trash',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.forumService.deleteTopic(topic._id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Tema eliminado' });
            if (this.view === 'thread') {
              // Go back to topics list
              if (this.selectedCategory) {
                this.goToTopics(this.selectedCategory);
              } else {
                this.goToCategories();
              }
            } else {
              this.loadTopics();
            }
          },
          error: (err: any) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo eliminar' });
          }
        });
      }
    });
  }

  deletePost(post: ForumPost) {
    this.confirmationService.confirm({
      message: '¿Eliminar esta respuesta?',
      header: 'Confirmar Eliminación',
      icon: 'pi pi-trash',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.forumService.deletePost(post._id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Respuesta eliminada' });
            this.loadThread();
          },
          error: (err: any) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo eliminar' });
          }
        });
      }
    });
  }
}
