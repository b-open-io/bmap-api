#!/usr/bin/env bun

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Simple types package builder that copies the main types.ts file
 * and builds the TypeScript package
 */
async function buildTypes() {
  console.log('🔄 Building types package...');

  const packagesDir = join(process.cwd(), 'packages/types');
  const srcDir = join(packagesDir, 'src');
  const mainTypesFile = join(process.cwd(), 'types.ts');
  const coreTypesFile = join(srcDir, 'core.ts');

  // Ensure src directory exists
  if (!existsSync(srcDir)) {
    mkdirSync(srcDir, { recursive: true });
  }

  // Copy main types file to core.ts
  console.log('📋 Copying types.ts to packages/types/src/core.ts');
  copyFileSync(mainTypesFile, coreTypesFile);

  console.log('✅ Types package ready for build');
}

if (import.meta.main) {
  await buildTypes();
}
