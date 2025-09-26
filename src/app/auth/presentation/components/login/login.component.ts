import { Component, inject } from '@angular/core';
import { ThemesService } from '../../../../shareds/services/themes.service';
import { TranslateService } from '@ngx-translate/core';
import { Lang } from '../../../../shareds/services/langi18/lang.interface';
import { LangService } from '../../../../shareds/services/langi18/lang.service';
import { AuthService } from '../../../../core/services/auth.service';
import { SystemService } from '../../../../core/services/system.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrl: './login.component.css',
    standalone: false
})
export class LoginComponent {
  loginForm: FormGroup;
  error: string = '';
  isLoading: boolean = false;
  rememberMe: boolean = false;
  systemContacts: any[] = [];
  isLoadingContacts: boolean = false;
  contactsLoaded: boolean = false;

  // UI/UX
  translate: TranslateService = inject(TranslateService);
  lang: string = 'es';
  theme: string = 'light';
  languages: Lang[] | undefined;

  constructor(
    public themes: ThemesService,
    public langService: LangService,
    private authService: AuthService,
    private systemService: SystemService,
    private fb: FormBuilder,
    private router: Router
  ) {
    const savedEmail = localStorage.getItem('rememberedEmail') || '';
    this.rememberMe = !!savedEmail;
    
    this.loginForm = this.fb.group({
      email: [savedEmail, [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }
  
  ngOnInit() {
    this.theme = this.themes.getCurrentTheme();
    this.languages = this.langService.getLanguages()
    this.translate.use(this.langService.selectedLang || 'es');

    // Load system contacts
    this.loadSystemContacts();
  }

  loadSystemContacts() {
    // Prevent multiple calls
    if (this.contactsLoaded || this.isLoadingContacts) {
      return;
    }

    console.log('Loading system contacts...');
    this.isLoadingContacts = true;

    this.systemService.getPublic().subscribe({
      next: (systems) => {
        console.log('System contacts loaded:', systems);
        if (systems && systems.length > 0) {
          const system = systems[0];
          this.systemContacts = system.contacts || [];
        } else {
          this.systemContacts = [];
        }
        this.contactsLoaded = true;
        this.isLoadingContacts = false;
      },
      error: (error) => {
        console.error('Error loading system contacts:', error);
        // Keep empty array if system contacts can't be loaded
        this.systemContacts = [];
        this.contactsLoaded = true; // Mark as loaded even on error to prevent retries
        this.isLoadingContacts = false;
      }
    });
  }

  login() {
    if (this.loginForm.invalid) {
      // Marcar todos los campos como tocados para mostrar los mensajes de validación
      Object.values(this.loginForm.controls).forEach(control => {
        control.markAsTouched();
      });
      return;
    }

    this.isLoading = true;
    this.error = '';

    const { email, password } = this.loginForm.value;
    
    if (this.rememberMe) {
      localStorage.setItem('rememberedEmail', email);
    } else {
      localStorage.removeItem('rememberedEmail');
    }
    
    this.authService.login(email, password).subscribe({
      next: (response) => {
        this.isLoading = false;
        // Guardar el token
        localStorage.setItem('token', response.token);
        // Redirigir a admin/management
        this.router.navigate(['/admin/management']);
      },
      error: (error) => {
        if (error.error?.message === 'Invalid credentials') {
          this.error = this.translate.instant('login.invalidCredentials');
        } else {
          this.error = this.translate.instant('login.defaultError');
        }
        this.isLoading = false;
      }
    });
  }

  toggleTheme() {
    this.themes.setTheme(this.theme === 'light' ? 'dark' : 'light');
    this.theme = this.themes.getCurrentTheme();
  }

  changeLang() {
    this.translate.use(this.langService.selectedLang || 'es');
    this.langService.setLanguage(this.langService.selectedLang);
  }

  getContactLink(contact: any): string {
    const value = contact.value || '';
    const type = contact.type || '';

    if (type === 'teléfono' || type === 'telefono' || value.includes('(')) {
      // Phone number - create WhatsApp link
      const cleanNumber = value.replace(/[^\d]/g, '');
      return `https://wa.me/${cleanNumber}`;
    } else if (type === 'correo' || value.includes('@')) {
      // Email
      return `mailto:${value}`;
    } else if (type === 'enlace' || value.startsWith('http')) {
      // Website link
      return value.startsWith('http') ? value : `https://${value}`;
    }

    // Default to WhatsApp if it looks like a phone number
    if (/^\d/.test(value)) {
      const cleanNumber = value.replace(/[^\d]/g, '');
      return `https://wa.me/${cleanNumber}`;
    }

    return value;
  }

  getContactIcon(contact: any): string {
    const type = contact.type || '';
    const icon = contact.icon || '';

    // Use custom icon if provided
    if (icon) {
      return icon;
    }

    // Default icons based on type
    if (type === 'teléfono' || type === 'telefono') {
      return 'pi-whatsapp';
    } else if (type === 'correo') {
      return 'pi-envelope';
    } else if (type === 'enlace') {
      return 'pi-globe';
    }

    // Default icon
    return 'pi-user';
  }
}
