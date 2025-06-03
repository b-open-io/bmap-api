#!/usr/bin/env bun

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface TypeExport {
  name: string;
  source: string;
  category: 'core' | 'analytics' | 'social' | 'api' | 'common';
}

/**
 * Automatically generates the types package from existing TypeBox schemas and TypeScript definitions
 * This ensures the published types are always in sync with the main API
 */
class TypesGenerator {
  private types: TypeExport[] = [];
  private schemaImports: Set<string> = new Set();

  async generateTypes() {
    console.log('🔄 Generating types package from source...');

    // Collect all type exports from different parts of the API
    await this.collectAnalyticsTypes();
    await this.collectSocialTypes();
    await this.collectEntityTypes();
    await this.collectCoreTypes();
    await this.collectCommonTypes();

    // Generate the package structure
    await this.generatePackageStructure();

    console.log(
      `✅ Generated ${this.types.length} types across ${this.getCategoryCount()} categories`
    );
  }

  private async collectAnalyticsTypes() {
    console.log('📊 Collecting analytics types...');

    // Read analytics/schemas.ts and extract all Static<typeof X> exports
    const analyticsSchemaPath = join(process.cwd(), 'analytics/schemas.ts');
    if (!existsSync(analyticsSchemaPath)) return;

    const content = await Bun.file(analyticsSchemaPath).text();

    // Extract all TypeBox schema exports and their Static types
    const schemaMatches = content.matchAll(/export const (\w+) = t\./g);
    const staticMatches = content.matchAll(/export type (\w+) = Static<typeof (\w+)>/g);

    for (const match of schemaMatches) {
      const schemaName = match[1];
      this.schemaImports.add(schemaName);
    }

    for (const match of staticMatches) {
      const typeName = match[1];
      this.types.push({
        name: typeName,
        source: 'analytics/schemas',
        category: 'analytics',
      });
    }
  }

  private async collectSocialTypes() {
    console.log('👥 Collecting social types...');

    // Check entities schemas
    const entitiesDir = join(process.cwd(), 'schemas/entities');
    if (!existsSync(entitiesDir)) return;

    const files = readdirSync(entitiesDir).filter((f) => f.endsWith('.ts') && f !== 'index.ts');

    for (const file of files) {
      const content = await Bun.file(join(entitiesDir, file)).text();
      const baseName = file.replace('.ts', '');

      // Extract TypeBox schemas and their types
      const staticMatches = content.matchAll(/export type (\w+) = Static<typeof (\w+)>/g);
      // Also extract regular TypeScript interfaces and types
      const interfaceMatches = content.matchAll(/export interface (\w+)/g);
      const typeMatches = content.matchAll(/export type (\w+)/g);

      for (const match of staticMatches) {
        const typeName = match[1];
        this.types.push({
          name: typeName,
          source: `schemas/entities/${baseName}`,
          category: 'social',
        });
      }

      for (const match of interfaceMatches) {
        const typeName = match[1];
        this.types.push({
          name: typeName,
          source: `schemas/entities/${baseName}`,
          category: 'social',
        });
      }

      for (const match of typeMatches) {
        const typeName = match[1];
        // Skip if it's already captured as a Static type
        if (!content.includes(`export type ${typeName} = Static<typeof`)) {
          this.types.push({
            name: typeName,
            source: `schemas/entities/${baseName}`,
            category: 'social',
          });
        }
      }
    }
  }

  private async collectEntityTypes() {
    console.log('🏗️ Collecting entity types...');

    // Collect from schemas/entities/index.ts if it exists
    const entitiesIndexPath = join(process.cwd(), 'schemas/entities/index.ts');
    if (!existsSync(entitiesIndexPath)) return;

    // const content = await Bun.file(entitiesIndexPath).text();
    // const exportMatches = content.matchAll(/export \* from ['"](\.\/\w+)['"]/g);

    // These are already covered by collectSocialTypes
  }

  private async collectCoreTypes() {
    console.log('🎯 Collecting core types...');

    // Read main types.ts
    const typesPath = join(process.cwd(), 'types.ts');
    if (!existsSync(typesPath)) return;

    const content = await Bun.file(typesPath).text();

    // Extract enums and interfaces
    const enumMatches = content.matchAll(/export enum (\w+)/g);
    const interfaceMatches = content.matchAll(/export interface (\w+)/g);
    const typeMatches = content.matchAll(/export type (\w+)/g);

    for (const match of enumMatches) {
      this.types.push({
        name: match[1],
        source: 'types',
        category: 'common',
      });
    }

    for (const match of interfaceMatches) {
      this.types.push({
        name: match[1],
        source: 'types',
        category: 'core',
      });
    }

    for (const match of typeMatches) {
      this.types.push({
        name: match[1],
        source: 'types',
        category: 'core',
      });
    }
  }

  private async collectCommonTypes() {
    console.log('🔧 Collecting common types...');

    // Add pagination, response wrappers, etc.
    const commonTypes = [
      'PaginationParams',
      'PaginationResponse',
      'ErrorResponse',
      'SuccessResponse',
      'TimestampedRecord',
    ];

    // These might be defined in various places, we'll create them if needed
    for (const typeName of commonTypes) {
      this.types.push({
        name: typeName,
        source: 'common/types',
        category: 'common',
      });
    }
  }

  private async generatePackageStructure() {
    const packagesDir = join(process.cwd(), 'packages/types');
    const srcDir = join(packagesDir, 'src');
    const distDir = join(packagesDir, 'dist');

    // Create directories
    for (const dir of [packagesDir, srcDir, distDir]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // Generate category-based exports
    await this.generateCategoryFiles(srcDir);

    // Generate main index file
    await this.generateMainIndex(srcDir);

    // Generate TypeScript config
    await this.generateTSConfig(packagesDir);

    console.log('📁 Generated package structure');
  }

  private async generateCategoryFiles(srcDir: string) {
    const categories = this.getCategories();

    for (const category of categories) {
      const categoryTypes = this.types.filter((t) => t.category === category);
      if (categoryTypes.length === 0) continue;

      const categoryDir = join(srcDir, category);
      if (!existsSync(categoryDir)) {
        mkdirSync(categoryDir, { recursive: true });
      }

      // Group by source file
      const bySource = this.groupBySource(categoryTypes);

      let indexContent = '';

      for (const [source, types] of Object.entries(bySource)) {
        const fileName = this.sourceToFileName(source);
        const filePath = join(categoryDir, `${fileName}.ts`);

        // Generate the type file
        const fileContent = await this.generateTypeFile(source, types);
        writeFileSync(filePath, fileContent);

        // Add to category index
        indexContent += `export * from './${fileName}';\n`;
      }

      // Write category index
      writeFileSync(join(categoryDir, 'index.ts'), indexContent);
    }
  }

  private async generateTypeFile(source: string, types: TypeExport[]): Promise<string> {
    let content = `// Auto-generated from ${source}\n`;
    content += "// Do not edit manually - regenerate with 'bun run build:types'\n\n";

    // Read the source file and extract the actual type definitions
    const sourceFilePath = join(process.cwd(), `${source}.ts`);
    if (!existsSync(sourceFilePath)) {
      console.warn(`Warning: Source file ${sourceFilePath} not found`);
      return content;
    }

    const sourceContent = await Bun.file(sourceFilePath).text();

    // Extract imports if needed
    const importMatches = sourceContent.matchAll(/import.*from.*['"]@sinclair\/typebox['"];?\n/g);
    for (const match of importMatches) {
      content += match[0];
    }
    if (importMatches.next().value) content += '\n';

    // Extract the actual type definitions for the types we want
    for (const type of types) {
      const typeRegex = new RegExp(
        `export\\s+(interface|type|enum)\\s+${type.name}[\\s\\S]*?(?=\\nexport|\\n\\n|$)`,
        'g'
      );
      const matches = sourceContent.matchAll(typeRegex);
      for (const match of matches) {
        content += `${match[0]}\n\n`;
      }
    }

    return content;
  }

  private async generateMainIndex(srcDir: string) {
    let content = '// Auto-generated types package\n';
    content += `// Do not edit manually - regenerate with 'bun run build:types'\n\n`;

    const categories = this.getCategories();
    for (const category of categories) {
      const categoryTypes = this.types.filter((t) => t.category === category);
      if (categoryTypes.length > 0) {
        content += `// ${category.charAt(0).toUpperCase() + category.slice(1)} Types\n`;
        content += `export * from './${category}';\n\n`;
      }
    }

    // Add convenience re-exports
    content += '// Convenience exports\n';
    content += `export { Timeframe } from './common';\n`;
    content += `export type { NetworkOverviewResponse, TrendingChannelsResponse } from './analytics';\n`;
    content += `export type { BAPIdentity, Post, Message, Friend, Like } from './social';\n`;

    writeFileSync(join(srcDir, 'index.ts'), content);
  }

  private async generateTSConfig(packagesDir: string) {
    const tsConfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        declaration: true,
        declarationMap: true,
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        allowSyntheticDefaultImports: true,
      },
      include: ['src/**/*'],
      exclude: ['dist', 'node_modules'],
    };

    writeFileSync(join(packagesDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));
  }

  private getCategories(): string[] {
    return ['core', 'analytics', 'social', 'api', 'common'];
  }

  private getCategoryCount(): number {
    return new Set(this.types.map((t) => t.category)).size;
  }

  private groupBySource(types: TypeExport[]): Record<string, TypeExport[]> {
    return types.reduce(
      (acc, type) => {
        if (!acc[type.source]) acc[type.source] = [];
        acc[type.source].push(type);
        return acc;
      },
      {} as Record<string, TypeExport[]>
    );
  }

  private sourceToFileName(source: string): string {
    return source.split('/').pop() || 'index';
  }

  private needsTypeBox(source: string): boolean {
    return source.includes('schemas') || source.includes('analytics');
  }
}

// Run the generator
const generator = new TypesGenerator();
await generator.generateTypes();
