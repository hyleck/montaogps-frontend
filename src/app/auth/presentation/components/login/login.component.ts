import { Component, inject } from '@angular/core';
import { ThemesService } from '../../../../shareds/services/themes.service';
import { TranslateService } from '@ngx-translate/core';
import { Lang } from '../../../../shareds/services/langi18/lang.interface';
import { LangService } from '../../../../shareds/services/langi18/lang.service';
import { AuthService } from '../../../../core/services/auth.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

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

  // UI/UX
  translate: TranslateService = inject(TranslateService);
  lang: string = 'es';
  theme: string = 'light';
  languages: Lang[] | undefined;

  constructor(
    public themes: ThemesService, 
    public langService: LangService, 
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }
  
  ngOnInit() {  
    this.theme = this.themes.getCurrentTheme();
    this.languages = this.langService.getLanguages()
    this.translate.use(this.langService.selectedLang || 'es');
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
    
    this.authService.login(email, password).subscribe({
      next: (response) => {
        this.isLoading = false;
        // Aquí puedes manejar la redirección después del login exitoso
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
}
