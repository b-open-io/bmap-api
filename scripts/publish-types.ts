#!/usr/bin/env bun

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TYPES_DIR = 'packages/types';
const PACKAGE_JSON_PATH = join(TYPES_DIR, 'package.json');
const MAIN_TYPES_PATH = 'types.ts';
const TARGET_TYPES_PATH = join(TYPES_DIR, 'src/core.ts');

function checkGitStatus() {
  console.log('🔍 Checking git status...');

  // Check if on master branch
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
    encoding: 'utf-8',
  }).trim();

  if (currentBranch !== 'master') {
    console.error(`❌ Must be on master branch. Currently on: ${currentBranch}`);
    console.error('   Switch to master: git checkout master');
    process.exit(1);
  }
  console.log('✅ On master branch');

  // Check if working directory is clean
  const status = execSync('git status --porcelain', {
    encoding: 'utf-8',
  }).trim();

  if (status) {
    console.error('❌ Working directory is not clean. Please commit all changes first:');
    console.error(status);
    process.exit(1);
  }
  console.log('✅ Working directory is clean');

  // Check if local master is in sync with remote
  try {
    execSync('git fetch origin master', { stdio: 'pipe' });
    const localCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    const remoteCommit = execSync('git rev-parse origin/master', { encoding: 'utf-8' }).trim();

    if (localCommit !== remoteCommit) {
      console.error('❌ Local master is not in sync with remote master');
      console.error('   Pull latest changes: git pull origin master');
      process.exit(1);
    }
    console.log('✅ Local master is in sync with remote');
  } catch (error) {
    console.error('❌ Failed to check remote sync:', error);
    process.exit(1);
  }
}

async function main() {
  console.log('🚀 Starting automated types publishing process...');

  try {
    // Step 0: Check git status
    checkGitStatus();

    // Step 1: Copy main types to packages/types/src/core.ts
    console.log('📋 Copying types from main types.ts to packages/types/src/core.ts...');
    const mainTypes = readFileSync(MAIN_TYPES_PATH, 'utf-8');
    writeFileSync(TARGET_TYPES_PATH, mainTypes);
    console.log('✅ Types copied successfully');

    // Step 2: Get latest version from npm and bump
    console.log('🔍 Checking latest version on npm...');
    let latestNpmVersion = '0.0.0';
    try {
      const npmInfo = execSync('npm view bmap-api-types version', {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      latestNpmVersion = npmInfo.trim();
      console.log(`📦 Latest npm version: ${latestNpmVersion}`);
    } catch {
      console.log('📦 Package not found on npm, starting from 0.0.0');
    }

    // Parse version and bump patch
    const versionParts = latestNpmVersion.split('.').map(Number);
    versionParts[2] += 1; // Bump patch version (0.0.x)
    const newVersion = versionParts.join('.');

    console.log('📦 Reading current package.json...');
    const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));

    console.log(`🔄 Bumping version from ${latestNpmVersion} to ${newVersion}`);
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

    // Step 4: Run lint fix to ensure clean formatting before commit
    console.log('🧹 Running lint fix before commit...');
    execSync('bun run lint:fix', {
      stdio: 'inherit',
    });

    // Step 5: Create release commit (always, regardless of publish flag)
    console.log('📝 Creating release commit...');
    execSync(
      'git add packages/types/package.json packages/types/src/index.ts packages/types/src/core.ts',
      {
        stdio: 'inherit',
      }
    );

    // Check if there are actually changes to commit
    const statusCheck = execSync('git status --porcelain --cached', {
      encoding: 'utf-8',
    }).trim();

    if (!statusCheck) {
      console.error('❌ No changes to commit after processing');
      process.exit(1);
    }

    execSync(`git commit -m "Release types v${newVersion}"`, {
      stdio: 'inherit',
    });
    console.log(`✅ Created release commit for v${newVersion}`);

    // Step 6: Push release commit to remote
    console.log('📤 Pushing release commit to remote...');
    execSync('git push origin master', {
      stdio: 'inherit',
    });
    console.log('✅ Release commit pushed to remote');

    // Step 7: Clean and build the package
    console.log('🧹 Cleaning previous build...');
    execSync('npm run clean', {
      cwd: TYPES_DIR,
      stdio: 'inherit',
    });

    console.log('🔨 Building package...');
    execSync('npm run build', {
      cwd: TYPES_DIR,
      stdio: 'inherit',
    });
    console.log('✅ Package built successfully');

    // Step 8: Check if we should publish
    const shouldPublish = process.argv.includes('--publish');
    const isDryRun = process.argv.includes('--dry-run');

    if (shouldPublish) {
      console.log('📤 Publishing to npm...');

      // Check if logged in to npm
      try {
        execSync('npm whoami', { stdio: 'pipe' });
        console.log('✅ npm login verified');
      } catch {
        console.error('❌ Not logged in to npm. Please run: npm login');
        process.exit(1);
      }

      // Since we already checked npm and bumped from latest, version should be available
      console.log(`✅ Version ${newVersion} is available (bumped from npm registry)`);

      // Publish the package
      console.log('📤 Publishing to npm registry...');
      if (isDryRun) {
        console.log('🔍 DRY RUN: Would publish to npm but --dry-run flag was used');
        console.log('📦 Command would be: npm publish --access public');
        console.log('🔄 Rolling back release commit and push for dry run...');
        execSync('git reset --hard HEAD~1', { stdio: 'inherit' });
        execSync('git push --force-with-lease origin master', { stdio: 'inherit' });
      } else {
        execSync('npm publish --access public', {
          cwd: TYPES_DIR,
          stdio: 'inherit',
        });
        console.log(`✅ Published bmap-api-types@${newVersion} successfully!`);
        console.log(`🔗 https://www.npmjs.com/package/bmap-api-types/v/${newVersion}`);
      }
    } else {
      console.log('📦 Package built but not published. Use --publish flag to publish.');
      console.log(`🏷️  New version: ${newVersion}`);
      console.log(`📁 Built files are in: ${TYPES_DIR}/dist/`);
      console.log('✅ Release commit created and pushed to remote');
    }

    console.log('🎉 Types generation completed successfully!');
  } catch (error) {
    console.error('❌ Error during types publishing process:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
