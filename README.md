# Montao GPS Frontend

Sistema de gestión y monitoreo GPS para vehículos desarrollado con Angular.

## 📋 Descripción

Montao GPS es una plataforma web que permite el monitoreo en tiempo real de vehículos, gestión de usuarios, roles y permisos, así como la generación de reportes y seguimiento de procesos. El sistema está diseñado para ofrecer una experiencia de usuario intuitiva y eficiente.

### 🚀 Características Principales

- **Monitoreo en Tiempo Real**: Seguimiento de vehículos con actualizaciones en tiempo real
- **Gestión de Usuarios**: Sistema completo de administración de usuarios con roles y permisos
- **Multi-idioma**: Soporte para Español, Inglés y Francés
- **Tema Personalizable**: Modo claro y oscuro
- **Reportes**: Generación de informes detallados y exportación
- **Interfaz Responsiva**: Diseño adaptable para diferentes dispositivos
- **Mapas Integrados**: Integración con Google Maps para visualización de rutas
- **Gráficos Interactivos**: Visualización de datos con Chart.js

## 🛠️ Tecnologías y Dependencias

### Core
- Angular v19.2.6
- TypeScript v5.5.2
- RxJS v7.8.0

### UI/UX
- PrimeNG v19.0.10
- PrimeIcons v7.0.0
- Google Maps JavaScript API
- Chart.js v4.4.9

### Internacionalización
- @ngx-translate/core v16.0.3
- @ngx-translate/http-loader v16.0.0

### Utilidades
- jwt-decode v4.0.0
- html2canvas v1.4.1

## ⚙️ Requisitos Previos

- Node.js (versión recomendada: 18.x o superior)
- npm (incluido con Node.js)
- Angular CLI v19.2.7
- Cuenta de Google Cloud Platform (para API de Google Maps)

## 📦 Instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/yourusername/montaogps-frontend.git
```

2. Instalar dependencias:
```bash
cd montaogps-frontend
npm install
```

3. Iniciar servidor de desarrollo:
```bash
ng serve
```

La aplicación estará disponible en `http://localhost:4200/`

## 🔧 Configuración

### Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
API_URL=your_api_url
GOOGLE_MAPS_KEY=your_google_maps_key
```

### Configuración de Idiomas

Los archivos de traducción se encuentran en:
- `public/i18n/es.json` (Español)
- `public/i18n/en.json` (Inglés)
- `public/i18n/fr.json` (Francés)

## 📚 Estructura del Proyecto

```
src/
├── app/
│   ├── admin/           # Módulos administrativos
│   │   ├── management/  # Gestión de usuarios y roles
│   │   ├── monitoring/  # Monitoreo de vehículos
│   │   └── reports/     # Generación de reportes
│   ├── auth/            # Autenticación y autorización
│   ├── core/            # Servicios core, guardias, interceptores
│   ├── shared/          # Componentes y servicios compartidos
│   └── features/        # Módulos de características
├── assets/             # Recursos estáticos
│   ├── i18n/          # Archivos de traducción
│   ├── images/        # Imágenes y logos
│   └── themes/        # Temas y estilos
└── environments/      # Configuraciones de entorno
```

## 📜 Scripts Disponibles

```bash
# Desarrollo
npm start           # Inicia servidor de desarrollo
npm run watch      # Compilación en modo watch

# Producción
npm run build      # Construye la aplicación para producción

# Testing
npm test          # Ejecuta pruebas unitarias
```

## 🚀 Despliegue

Para construir el proyecto para producción:

```bash
ng build --configuration production
```

Los archivos de distribución se generarán en el directorio `dist/`.

## 🧪 Pruebas

### Pruebas Unitarias
```bash
ng test
```

### Pruebas E2E
```bash
ng e2e
```

## 👥 Contribución

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE.md](LICENSE.md) para detalles

## 🤝 Soporte

Para soporte y consultas:
- Email: info@montao.net
- Teléfono: (809) 555-0123

## 🔄 Versionado

Usamos [SemVer](http://semver.org/) para el versionado. Para ver las versiones disponibles, mira los [tags en este repositorio](https://github.com/yourusername/montaogps-frontend/tags).

---
Desarrollado con ❤️ por el equipo de Montao GPS
