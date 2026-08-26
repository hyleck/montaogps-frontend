const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(compression());

const PORT = process.env.PORT || 4200;
const staticDir = path.join(__dirname, '/dist/montaogps-frontend/browser');
const indexPath = path.join(staticDir, 'index.html');

// Detectar si estamos sirviendo archivos de producción
const isProductionBuild = fs.existsSync(indexPath);

function normalizeBuildAsset(resource) {
  try {
    const url = new URL(resource, 'https://montao.invalid/');
    return /\.(?:js|css)$/i.test(url.pathname) ? url.pathname : '';
  } catch {
    return '';
  }
}

function readAppVersionManifest() {
  if (!fs.existsSync(indexPath)) {
    return { version: 'development', assets: [] };
  }

  const indexContent = fs.readFileSync(indexPath, 'utf8');
  const assetPatterns = [
    /<script\b[^>]*\bsrc=["']([^"']+\.js(?:\?[^"']*)?)["'][^>]*>/gi,
    /<link\b(?=[^>]*\brel=["'][^"']*\bstylesheet\b[^"']*["'])[^>]*\bhref=["']([^"']+\.css(?:\?[^"']*)?)["'][^>]*>/gi,
  ];
  const assets = assetPatterns.flatMap(pattern =>
    Array.from(indexContent.matchAll(pattern), match =>
      normalizeBuildAsset(match[1]),
    ),
  ).filter(Boolean);
  const normalizedAssets = Array.from(new Set(assets)).sort();
  const version = crypto
    .createHash('sha256')
    .update(JSON.stringify(normalizedAssets))
    .digest('hex')
    .slice(0, 20);

  return {
    version,
    assets: normalizedAssets,
    builtAt: fs.statSync(indexPath).mtime.toISOString(),
  };
}

// Servir archivos estáticos de Angular controlando el cache
const hashedAssetRegex = /-[A-F0-9]{8,}\.(?:js|css|png|jpe?g|webp|svg|woff2?)$/i;
app.use(express.static(staticDir, {
  setHeaders: (res, resourcePath) => {
    if (resourcePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-store');
      return;
    }

    if (/\.(?:js|css|html|json|ico)$/i.test(resourcePath)) {
      res.setHeader('Cache-Control', 'no-store');
      return;
    }

    if (hashedAssetRegex.test(resourcePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

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
    "media-src 'self' blob: https://tracker-back.dorhu.com; " +
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

app.get('/app-version', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.status(200).json(readAppVersionManifest());
});

// Todas las otras rutas deben devolver index.html (para SPA routing)
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(indexPath);
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
