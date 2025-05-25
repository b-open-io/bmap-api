# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a high-performance Bitcoin SV transaction processing and serving API built with Bun and Elysia.js. The service processes Bitcoin transactions, provides social features (friends, likes, channels), caching, and real-time updates via Server-Sent Events (SSE).

## Development Commands

```bash
# Development with hot reload
bun run dev

# Production server
bun run start

# Type checking (run before committing)
bun run typecheck

# Lint checking
bun run lint

# Auto-fix linting issues
bun run lint:fix

# Test Redis connectivity
bun run test-redis

# Run tests
bun test
```

## Architecture Overview

### Core Components

1. **Transaction Processing Pipeline**
   - `process.ts`: Handles ingestion and normalization of Bitcoin transactions
   - `bap.ts`: Bitcoin Attestation Protocol identity management
   - Uses MongoDB collections `c` (confirmed) and `u` (unconfirmed)

2. **Caching Layer**
   - `cache.ts`: Redis caching strategy for transactions and identities
   - Key patterns: `tx:{txid}`, `identity:{bapId}`, `social:{type}:{id}`
   - Auto-invalidation on updates

3. **Social Features** (`/social/`)
   - Friends graph management
   - Like system with BAP signatures
   - Channel-based messaging
   - All queries in `/social/queries/` directory

4. **API Framework**
   - Elysia.js with automatic Swagger documentation
   - Routes organized by feature (main routes in `index.ts`, social in `social/routes.ts`)
   - Swagger definitions in `/social/swagger/`

5. **Real-time Updates**
   - SSE endpoints for transaction streaming
   - JungleBus integration for blockchain events

### Key Design Patterns

1. **Query Separation**: Database queries isolated in `/queries/` and `/social/queries/` directories
2. **Type Safety**: Comprehensive TypeScript types in `types.ts`
3. **Error Handling**: Structured error responses with proper HTTP status codes
4. **Caching Strategy**: Write-through cache with TTL-based expiration
5. **Documentation**: Swagger decorators on all API endpoints

## Testing Approach

Tests use Bun's built-in test runner with mocking for external dependencies:
- Test files in `/tests/` directory
- Mock Redis and MongoDB connections
- Run with `bun test`

## Code Quality Tools

- **Biome**: Linting and formatting (configured in `biome.json`)
- **TypeScript**: Strict type checking with `bun run typecheck`
- **Git Hooks**: Pre-commit and pre-push checks automatically run linting and type checking

## Environment Requirements

Required environment variables:
- `REDIS_PRIVATE_URL`: Redis connection string
- `BMAP_MONGO_URL`: MongoDB connection URL

## API Documentation

Interactive Swagger documentation available at `/docs` when server is running. OpenAPI spec at `/docs/json`.