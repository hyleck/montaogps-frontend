const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4200;

// Detectar si estamos sirviendo archivos de producción
const isProductionBuild = require('fs').existsSync(path.join(__dirname, '/dist/montaogps-frontend/browser/main-J2MBITJD.js'));

// Servir archivos estáticos de Angular
app.use(express.static(path.join(__dirname, '/dist/montaogps-frontend/browser/')));

// Configurar CORS optimizado para beta.montao.net y tracker.dorhu.com
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://beta.montao.net',
    'https://tracker.dorhu.com',
    'http://localhost:4200',
    'http://localhost:3000'
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Configurar Content Security Policy para mapas
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://api.mapbox.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https: blob:; " +
    "connect-src 'self' https: wss: blob:; " +
    "frame-src 'self' https:; " +
    "worker-src 'self' blob:;"
  );
  next();
});

// Ruta de health check para Heroku
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'MontaoGPS Frontend'
  });
});

// Todas las otras rutas deben devolver index.html (para SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '/dist/montaogps-frontend/browser/index.html'));
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: isProductionBuild ? 'Internal Server Error' : err.message
  });
});

app.listen(PORT, () => {
  console.log(`🚀 MontaoGPS Frontend server running on port ${PORT}`);
  console.log(`📍 Build Type: ${isProductionBuild ? 'production' : 'development'}`);
  console.log(`📦 Serving files from: /dist/montaogps-frontend/browser/`);

  if (isProductionBuild) {
    console.log(`🌐 Production Build: URLs replaced with production endpoints`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  } else {
    console.log(`🌐 Development Build: Using localhost URLs`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  }
});

// Manejo graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received. Shutting down gracefully...');
  process.exit(0);
}); 