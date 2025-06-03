#!/usr/bin/env bun

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TYPES_DIR = 'packages/types';
const PACKAGE_JSON_PATH = join(TYPES_DIR, 'package.json');
const MAIN_TYPES_PATH = 'types.ts';
const TARGET_TYPES_PATH = join(TYPES_DIR, 'src/core.ts');

async function main() {
  console.log('🚀 Starting automated types publishing process...');

  try {
    // Step 1: Copy main types to packages/types/src/core.ts
    console.log('📋 Copying types from main types.ts to packages/types/src/core.ts...');
    const mainTypes = readFileSync(MAIN_TYPES_PATH, 'utf-8');
    writeFileSync(TARGET_TYPES_PATH, mainTypes);
    console.log('✅ Types copied successfully');

    // Step 2: Bump version in package.json
    console.log('📦 Reading current package.json...');
    const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
    const currentVersion = packageJson.version;

    // Parse version and bump patch
    const versionParts = currentVersion.split('.').map(Number);
    versionParts[2] += 1; // Bump patch version (0.0.x)
    const newVersion = versionParts.join('.');

    console.log(`🔄 Bumping version from ${currentVersion} to ${newVersion}`);
    packageJson.version = newVersion;
    writeFileSync(PACKAGE_JSON_PATH, `${JSON.stringify(packageJson, null, 2)}\n`);

    // Step 3: Update version in src/index.ts
    console.log('📝 Updating version in src/index.ts...');
    const indexPath = join(TYPES_DIR, 'src/index.ts');
    let indexContent = readFileSync(indexPath, 'utf-8');
    indexContent = indexContent.replace(
      /export const VERSION = '[^']+';/,
      `export const VERSION = '${newVersion}';`
    );
    writeFileSync(indexPath, indexContent);

    // Step 4: Build the package
    console.log('🔨 Building package...');
    execSync('bun run build', {
      cwd: TYPES_DIR,
      stdio: 'inherit',
    });
    console.log('✅ Package built successfully');

    // Step 5: Check if we should publish
    const shouldPublish = process.argv.includes('--publish');

    if (shouldPublish) {
      console.log('📤 Publishing to npm...');

      // Check if logged in to npm
      try {
        execSync('npm whoami', { stdio: 'pipe' });
      } catch {
        console.error('❌ Not logged in to npm. Please run: npm login');
        process.exit(1);
      }

      // Publish the package
      execSync('npm publish --access public', {
        cwd: TYPES_DIR,
        stdio: 'inherit',
      });
      console.log(`✅ Published bmap-api-types@${newVersion} successfully!`);
    } else {
      console.log('📦 Package built but not published. Use --publish flag to publish.');
      console.log(`🏷️  New version: ${newVersion}`);
      console.log(`📁 Built files are in: ${TYPES_DIR}/dist/`);
    }

    console.log('🎉 Types generation completed successfully!');
  } catch (error) {
    console.error('❌ Error during types publishing process:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
