#!/usr/bin/env node

const { execSync } = require('child_process');

// Get the environment from environment variable, default to 'production'
const environment = process.env.environment || 'production';

console.log(`🚀 Building Angular application with configuration: ${environment}`);

// Run the Angular build command with the specified configuration
try {
  execSync(`ng build --configuration ${environment}`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log(`✅ Build completed successfully with ${environment} configuration`);
} catch (error) {
  console.error(`❌ Build failed with ${environment} configuration`);
  process.exit(1);
}