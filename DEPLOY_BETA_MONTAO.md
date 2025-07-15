# 🚀 Despliegue Específico: beta.montao.net

Guía rápida para desplegar MontaoGPS Frontend en **https://beta.montao.net**

## ⚡ Comandos de Despliegue Rápido

```bash
# 1. Conectar con Heroku
heroku git:remote -a montao-gps-beta

# 2. Verificar configuración
heroku config

# 3. Configurar variables de entorno (si no están configuradas)
heroku config:set NODE_ENV=production
heroku config:set GOOGLE_MAPS_API_KEY=tu_google_maps_api_key
heroku config:set MAPBOX_ACCESS_TOKEN=tu_mapbox_access_token

# 4. Commit y despliegue
git add .
git commit -m "Deploy MontaoGPS Frontend to beta.montao.net"
git push heroku main

# 5. Verificar despliegue
heroku open
heroku logs --tail
```

## 🔧 Variables de Entorno para beta.montao.net

| Variable | Estado | Descripción |
|----------|--------|-------------|
| `NODE_ENV` | ✅ Requerida | `production` |
| `GOOGLE_MAPS_API_KEY` | ⚠️ Configurar | API Key de Google Maps |
| `MAPBOX_ACCESS_TOKEN` | ⚠️ Configurar | Token de Mapbox |

## 🌐 URLs de la Aplicación

- **🏠 Aplicación Principal**: https://beta.montao.net
- **🔐 Login**: https://beta.montao.net/auth/login
- **📊 Dashboard**: https://beta.montao.net/admin/dashboard
- **📍 Seguimiento**: https://beta.montao.net/admin/follow-up
- **📋 Reportes**: https://beta.montao.net/admin/reports
- **⚙️ Configuración**: https://beta.montao.net/admin/settings
- **🏥 Health Check**: https://beta.montao.net/health

## 📊 Verificación Post-Despliegue

```bash
# Ver logs en tiempo real
heroku logs --tail

# Verificar estado de la aplicación
heroku ps

# Verificar configuración
heroku config

# Probar health check
curl https://beta.montao.net/health

# Reiniciar si es necesario
heroku restart
```

## 🚨 Troubleshooting Rápido

### Si la aplicación no carga:
```bash
heroku logs --tail
heroku ps:scale web=1
heroku restart
```

### Si hay errores de CORS:
- Verificar que el backend permita `https://beta.montao.net`
- Las configuraciones de CORS están optimizadas en `server.js`

### Si hay errores de mapas:
- Verificar `GOOGLE_MAPS_API_KEY`
- Verificar `MAPBOX_ACCESS_TOKEN`
- Asegurar que los dominios están autorizados en las consolas de Google/Mapbox

## ⚡ Actualizaciones Rápidas

```bash
# Para actualizaciones menores
git add .
git commit -m "Minor updates"
git push heroku main

# Para actualizaciones importantes
git add .
git commit -m "feat: descripción del cambio"
git push heroku main
heroku logs --tail
```

## 📈 Monitoreo

- **Health Check**: https://beta.montao.net/health
- **Logs**: `heroku logs --tail`
- **Métricas**: Panel de Heroku
- **Estado**: `heroku ps`

---

✅ **Tu aplicación MontaoGPS está configurada para https://beta.montao.net**

🔗 **URL Principal**: https://beta.montao.net
🏥 **Health Check**: https://beta.montao.net/health 