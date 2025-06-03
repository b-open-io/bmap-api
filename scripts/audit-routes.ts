#!/usr/bin/env bun

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Comprehensive route and schema audit for BMAP API
 * This script analyzes all routes to ensure consistency between:
 * - Elysia route definitions (source of truth)
 * - TypeBox schemas
 * - Swagger documentation
 * - README documentation
 */

interface RouteInfo {
  method: string;
  path: string;
  file: string;
  hasParams?: boolean;
  hasQuery?: boolean;
  hasBody?: boolean;
  hasResponse?: boolean;
  hasDetail?: boolean;
  schemas: string[];
  tags: string[];
}

interface AuditResult {
  routes: RouteInfo[];
  issues: string[];
  schemas: Set<string>;
  tags: Set<string>;
  summary: {
    totalRoutes: number;
    routesWithSchemas: number;
    routesWithDocs: number;
    schemaCount: number;
    tagCount: number;
  };
}

class RouteAuditor {
  private routes: RouteInfo[] = [];
  private issues: string[] = [];
  private allSchemas = new Set<string>();
  private allTags = new Set<string>();

  async auditAllRoutes(): Promise<AuditResult> {
    console.log('🔍 Starting comprehensive route audit...');

    // Audit route files
    await this.auditRouteFile('social/routes.ts', '/social');
    await this.auditRouteFile('analytics/routes.ts', '/analytics|/health');
    await this.auditRouteFile('routes/transaction.ts');
    await this.auditRouteFile('routes/query.ts');
    await this.auditRouteFile('routes/chart.ts');

    // Check for schema consistency
    await this.checkSchemaConsistency();

    // Check README documentation
    await this.checkReadmeConsistency();

    // Generate summary
    const summary = {
      totalRoutes: this.routes.length,
      routesWithSchemas: this.routes.filter((r) => r.schemas.length > 0).length,
      routesWithDocs: this.routes.filter((r) => r.hasDetail).length,
      schemaCount: this.allSchemas.size,
      tagCount: this.allTags.size,
    };

    return {
      routes: this.routes,
      issues: this.issues,
      schemas: this.allSchemas,
      tags: this.allTags,
      summary,
    };
  }

  private async auditRouteFile(filePath: string, pathPrefix = '') {
    const fullPath = join(process.cwd(), filePath);
    if (!existsSync(fullPath)) {
      this.issues.push(`Route file not found: ${filePath}`);
      return;
    }

    console.log(`📁 Auditing ${filePath}...`);
    const content = readFileSync(fullPath, 'utf-8');

    // Extract route definitions
    const routeMatches = content.matchAll(
      /\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g
    );

    for (const match of routeMatches) {
      const [, method, path] = match;
      const fullPath = pathPrefix ? `${pathPrefix.split('|')[0]}${path}` : path;

      const route: RouteInfo = {
        method: method.toUpperCase(),
        path: fullPath,
        file: filePath,
        schemas: [],
        tags: [],
      };

      // Find the route configuration block
      const routeIndex = match.index || 0;
      const configMatch = this.extractRouteConfig(content, routeIndex);

      if (configMatch) {
        // Check for schema usage
        route.hasParams = configMatch.includes('params:');
        route.hasQuery = configMatch.includes('query:');
        route.hasBody = configMatch.includes('body:');
        route.hasResponse = configMatch.includes('response:');
        route.hasDetail = configMatch.includes('detail:');

        // Extract schema names
        const schemaMatches = configMatch.matchAll(/(\w+Schema|\w+Params|\w+Response)/g);
        for (const [, schema] of schemaMatches) {
          route.schemas.push(schema);
          this.allSchemas.add(schema);
        }

        // Extract tags
        const tagMatches = configMatch.matchAll(/tags:\s*\[([^\]]+)\]/g);
        for (const [, tagList] of tagMatches) {
          const tags = tagList.split(',').map((t) => t.trim().replace(/['"]/g, ''));
          route.tags.push(...tags);
          for (const tag of tags) {
            this.allTags.add(tag);
          }
        }
      }

      this.routes.push(route);
    }
  }

  private extractRouteConfig(content: string, startIndex: number): string | null {
    // Find the third argument of the route method (config object)
    let parenCount = 0;
    let commaCount = 0;
    let configStart = -1;
    let configEnd = -1;
    let braceCount = 0;
    let inConfig = false;

    // Start from the method call position
    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];

      if (char === '(') {
        parenCount++;
      } else if (char === ')') {
        parenCount--;
        if (parenCount === 0 && inConfig) {
          // End of the method call
          break;
        }
      } else if (char === ',' && parenCount === 1) {
        commaCount++;
        if (commaCount === 2) {
          // This should be the start of the config object
          // Find the opening brace
          for (let j = i + 1; j < content.length; j++) {
            if (content[j] === '{') {
              configStart = j;
              braceCount = 1;
              inConfig = true;
              i = j;
              break;
            }
            if (content[j] === ')') {
              // No config object found
              return null;
            }
          }
        }
      } else if (inConfig) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            configEnd = i;
            break;
          }
        }
      }
    }

    if (configStart !== -1 && configEnd !== -1) {
      return content.slice(configStart, configEnd + 1);
    }
    return null;
  }

  private async checkSchemaConsistency() {
    console.log('🔍 Checking schema consistency...');

    // Check if schemas exist in schema files
    const schemaFiles = [
      'social/schemas.ts',
      'analytics/schemas.ts',
      'schemas/entities/bap.ts',
      'schemas/entities/like.ts',
      'schemas/entities/message.ts',
      'schemas/entities/post.ts',
    ];

    const definedSchemas = new Set<string>();

    for (const file of schemaFiles) {
      const fullPath = join(process.cwd(), file);
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, 'utf-8');

        // Find schema exports
        const exports = content.matchAll(
          /export\s+(?:const|type)\s+(\w+(?:Schema|Params|Response))/g
        );
        for (const [, schemaName] of exports) {
          definedSchemas.add(schemaName);
        }
      }
    }

    // Check for missing schemas
    for (const schema of this.allSchemas) {
      if (!definedSchemas.has(schema)) {
        this.issues.push(`Schema referenced but not defined: ${schema}`);
      }
    }

    // Check for unused schemas
    for (const schema of definedSchemas) {
      if (!this.allSchemas.has(schema)) {
        this.issues.push(`Schema defined but not used: ${schema}`);
      }
    }
  }

  private async checkReadmeConsistency() {
    console.log('📖 Checking README consistency...');

    const readmePath = join(process.cwd(), 'README.md');
    if (!existsSync(readmePath)) {
      this.issues.push('README.md not found');
      return;
    }

    const readmeContent = readFileSync(readmePath, 'utf-8');

    // Extract documented endpoints from README
    const documentedEndpoints = new Set<string>();
    const endpointMatches = readmeContent.matchAll(/`(GET|POST|PUT|DELETE)\s+([^`]+)`/g);

    for (const [, method, path] of endpointMatches) {
      documentedEndpoints.add(`${method} ${path}`);
    }

    // Check for undocumented routes
    for (const route of this.routes) {
      const routeSignature = `${route.method} ${route.path}`;
      if (!documentedEndpoints.has(routeSignature)) {
        this.issues.push(`Route not documented in README: ${routeSignature}`);
      }
    }

    // Check for documented but non-existent routes
    for (const documented of documentedEndpoints) {
      const exists = this.routes.some((r) => `${r.method} ${r.path}` === documented);
      if (!exists) {
        this.issues.push(`README documents non-existent route: ${documented}`);
      }
    }
  }

  generateReport(result: AuditResult): string {
    let report = '# BMAP API Route Audit Report\n\n';

    report += '## Summary\n';
    report += `- **Total Routes**: ${result.summary.totalRoutes}\n`;
    report += `- **Routes with Schemas**: ${result.summary.routesWithSchemas}\n`;
    report += `- **Routes with Documentation**: ${result.summary.routesWithDocs}\n`;
    report += `- **Total Schemas**: ${result.summary.schemaCount}\n`;
    report += `- **Total Tags**: ${result.summary.tagCount}\n`;
    report += `- **Issues Found**: ${result.issues.length}\n\n`;

    if (result.issues.length > 0) {
      report += '## Issues Found\n\n';
      for (const issue of result.issues) {
        report += `- ⚠️ ${issue}\n`;
      }
      report += '\n';
    }

    report += '## Route Inventory\n\n';
    report += '| Method | Path | File | Schemas | Tags | Documented |\n';
    report += '|--------|------|------|---------|------|------------|\n';

    for (const route of result.routes.sort((a, b) => a.path.localeCompare(b.path))) {
      const schemas = route.schemas.length > 0 ? route.schemas.join(', ') : '-';
      const tags = route.tags.length > 0 ? route.tags.join(', ') : '-';
      const documented = route.hasDetail ? '✅' : '❌';

      report += `| ${route.method} | ${route.path} | ${route.file} | ${schemas} | ${tags} | ${documented} |\n`;
    }

    report += '\n## Schema Usage\n\n';
    for (const schema of Array.from(result.schemas).sort()) {
      const usedIn = result.routes.filter((r) => r.schemas.includes(schema));
      report += `- **${schema}**: Used in ${usedIn.length} route(s)\n`;
    }

    report += '\n## Tags Used\n\n';
    for (const tag of Array.from(result.tags).sort()) {
      const routesWithTag = result.routes.filter((r) => r.tags.includes(tag));
      report += `- **${tag}**: ${routesWithTag.length} route(s)\n`;
    }

    return report;
  }
}

// Run the audit
const auditor = new RouteAuditor();
const result = await auditor.auditAllRoutes();
const report = auditor.generateReport(result);

console.log('\n📊 AUDIT COMPLETE!\n');
console.log(report);

// Write report to file
const fs = await import('node:fs/promises');
await fs.writeFile('ROUTE_AUDIT_REPORT.md', report);
console.log('📝 Report saved to ROUTE_AUDIT_REPORT.md');
