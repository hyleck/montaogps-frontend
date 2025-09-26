#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Preparando proyecto para despliegue en Heroku...\n');

// Verificar archivos necesarios
const requiredFiles = [
  'package.json',
  'server.js',
  'Procfile',
  'angular.json',
  'src/index.html'
];

console.log('📋 Verificando archivos necesarios:');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - FALTA`);
    process.exit(1);
  }
});

// Verificar package.json
console.log('\n📦 Verificando package.json:');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Verificar scripts necesarios
const requiredScripts = ['start', 'build', 'heroku-postbuild'];
requiredScripts.forEach(script => {
  if (packageJson.scripts[script]) {
    console.log(`✅ Script "${script}": ${packageJson.scripts[script]}`);
  } else {
    console.log(`❌ Script "${script}" falta`);
  }
});

// Verificar engines
if (packageJson.engines) {
  console.log(`✅ Node version: ${packageJson.engines.node}`);
  console.log(`✅ NPM version: ${packageJson.engines.npm}`);
} else {
  console.log('⚠️  Engines no especificados en package.json');
}

// Verificar dependencias críticas
const criticalDeps = ['express', '@angular/cli', '@angular/compiler-cli', 'typescript'];
console.log('\n🔍 Verificando dependencias críticas:');
criticalDeps.forEach(dep => {
  if (packageJson.dependencies[dep]) {
    console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
  } else {
    console.log(`❌ ${dep} - FALTA EN DEPENDENCIES`);
  }
});

// Probar build de producción
console.log('\n🔨 Probando build de producción...');
try {
  console.log('Ejecutando: npm run build');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build de producción exitoso');
} catch (error) {
  console.log('❌ Error en build de producción');
  console.error(error.message);
  process.exit(1);
}

// Verificar archivos generados
const distPath = 'dist/montaogps-frontend';
if (fs.existsSync(distPath)) {
  console.log(`✅ Archivos generados en ${distPath}`);
  
  // Verificar archivos críticos en dist
  const criticalDistFiles = ['index.html', 'main.js'];
  criticalDistFiles.forEach(file => {
    const filePath = path.join(distPath, file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file} generado`);
    } else {
      console.log(`⚠️  ${file} no encontrado en dist`);
    }
  });
} else {
  console.log(`❌ Directorio ${distPath} no existe`);
  process.exit(1);
}

// Probar servidor local
console.log('\n🌐 Probando servidor local...');
console.log('Para probar el servidor local manualmente, ejecuta:');
console.log('  node server.js');
console.log('Luego abre: http://localhost:4200');

// Resumen final
console.log('\n✅ ¡Proyecto listo para Heroku!');
console.log('\nPróximos pasos:');
console.log('1. heroku git:remote -a montao-gps-beta');
console.log('2. heroku config:set NODE_ENV=production');
console.log('3. heroku config:set environment=production  # Variable de entorno para el build');
console.log('4. heroku config:set GOOGLE_MAPS_API_KEY=tu_api_key');
console.log('5. heroku config:set MAPBOX_ACCESS_TOKEN=tu_token');
console.log('6. git add . && git commit -m "Ready for Heroku"');
console.log('7. git push heroku main');
console.log('\nURL de la aplicación: https://beta.montao.net');
console.log('Para más detalles, consulta HEROKU_DEPLOY.md');

console.log('\n🎉 ¡Listo para despegar!'); 