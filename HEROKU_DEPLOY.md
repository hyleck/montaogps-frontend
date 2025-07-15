# 🚀 Despliegue en Heroku - MontaoGPS Frontend

Este documento describe cómo desplegar la aplicación Angular MontaoGPS Frontend en Heroku.

## 📋 Prerrequisitos

- Cuenta de Heroku activa
- Heroku CLI instalado
- Git configurado
- Node.js 18.x o superior

## 🔧 Configuración del Proyecto

El proyecto ya está configurado para Heroku con:

- ✅ `server.js` - Servidor Express para producción
- ✅ `Procfile` - Configuración de procesos de Heroku
- ✅ `package.json` optimizado con scripts de Heroku
- ✅ `angular.json` optimizado para builds de producción

## 🚀 Pasos para Desplegar

### 1. Conectar con la aplicación existente en Heroku

```bash
# Iniciar sesión en Heroku
heroku login

# Conectar con la aplicación existente (beta.montao.net)
heroku git:remote -a montao-gps-beta

# Verificar la conexión
heroku apps:info
```

### 2. Configurar Variables de Entorno

```bash
# Configurar variables de entorno necesarias
heroku config:set NODE_ENV=production
heroku config:set GOOGLE_MAPS_API_KEY=tu_google_maps_api_key
heroku config:set MAPBOX_ACCESS_TOKEN=tu_mapbox_access_token

# Ver variables configuradas
heroku config
```

### 3. Desplegar la aplicación

```bash
# Asegurar que todos los cambios están commitados
git add .
git commit -m "Preparar para despliegue en Heroku"

# Desplegar a Heroku
git push heroku main

# O si usas otra rama
git push heroku tu-rama:main
```

### 4. Verificar el despliegue

```bash
# Abrir la aplicación en el navegador
heroku open

# Ver logs en tiempo real
heroku logs --tail

# Verificar estado de la aplicación
heroku ps
```

## 🔧 Variables de Entorno Requeridas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NODE_ENV` | Entorno de ejecución | `production` |
| `GOOGLE_MAPS_API_KEY` | API Key de Google Maps | `AIzaSyC...` |
| `MAPBOX_ACCESS_TOKEN` | Token de acceso de Mapbox | `pk.eyJ1...` |

## 📊 Monitoreo y Logs

```bash
# Ver logs de la aplicación
heroku logs --tail

# Ver logs de build
heroku logs --source app --tail

# Ver métricas de la aplicación
heroku ps:scale web=1

# Reiniciar la aplicación
heroku restart
```

## 🏥 Health Check

La aplicación incluye un endpoint de health check:

```
GET https://beta.montao.net/health
```

Respuesta:
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "service": "MontaoGPS Frontend"
}
```

## 🛠️ Troubleshooting

### Error: "Application Error"
```bash
# Ver logs detallados
heroku logs --tail

# Verificar variables de entorno
heroku config

# Reiniciar la aplicación
heroku restart
```

### Error de Build
```bash
# Verificar Node.js y npm versions
heroku config:set NODE_VERSION=18.x
heroku config:set NPM_VERSION=10.x

# Limpiar cache de build
heroku plugins:install heroku-builds
heroku builds:cache:purge
```

### Problemas de CORS
- Las configuraciones de CORS están en `server.js`
- Ajustar según las URLs de tu backend

## 🔄 Actualizaciones

Para actualizar la aplicación:

```bash
# Hacer cambios en el código
git add .
git commit -m "Descripción de cambios"

# Desplegar nueva versión
git push heroku main

# Verificar despliegue
heroku logs --tail
```

## 📝 Notas Importantes

1. **Build Automático**: Heroku ejecutará `npm run heroku-postbuild` automáticamente
2. **Puerto Dinámico**: El servidor usa `process.env.PORT` asignado por Heroku
3. **Archivos Estáticos**: Se sirven desde `/dist/montaogps-frontend`
4. **SPA Routing**: Todas las rutas redirigen a `index.html` para Angular Router
5. **Content Security Policy**: Configurado para mapas de Google y Mapbox

## 🌐 URLs de la Aplicación

- **Aplicación**: `https://beta.montao.net`
- **Health Check**: `https://beta.montao.net/health`
- **Login**: `https://beta.montao.net/auth/login`
- **Dashboard**: `https://beta.montao.net/admin/dashboard`
- **Reportes**: `https://beta.montao.net/admin/reports`

## 📞 Soporte

Si tienes problemas con el despliegue:

1. Revisar logs: `heroku logs --tail`
2. Verificar configuración: `heroku config`
3. Consultar documentación de Heroku
4. Contactar al equipo de desarrollo

---

✅ **¡Tu aplicación MontaoGPS Frontend está lista para Heroku!** 