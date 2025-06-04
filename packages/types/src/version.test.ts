import packageJson from '../package.json' with { type: 'json' };
import { VERSION } from './index.js';

// Simple assertion test
if (VERSION !== packageJson.version) {
  throw new Error(
    `Version mismatch: exported VERSION "${VERSION}" !== package.json version "${packageJson.version}"`
  );
}

console.log(`✅ Version test passed: ${VERSION}`);
