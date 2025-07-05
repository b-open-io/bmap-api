# BMAP API Project Documentation

## Overview

The BMAP API is a production-ready Bitcoin SV transaction processing and social features API. It demonstrates modern TypeScript development practices with Elysia.js framework, automatic type generation, and single source of truth architecture.

## Current State (2024)

**Status**: ✅ **PRODUCTION READY**
- **35 API endpoints** across 6 categories
- **Comprehensive analytics suite** (Phase 1 complete)
- **Full social networking features** 
- **Real-time capabilities** via SSE and WebSocket
- **Type-safe API** with TypeBox validation
- **Auto-generated documentation** and types

## Debugging & Development Methodology

### Iterative Problem-Solving Process

**1. Validation Error Diagnosis**:
```bash
# Test endpoint and capture detailed error
curl "http://localhost:3055/endpoint" | jq .error

# Look for specific validation patterns:
# - "Expected required property" = missing field
# - "Expected string but found undefined" = type mismatch
# - Path shows exact location: "/signers/0/addresses/0/txId"
```

**2. Database Schema Investigation**:
```bash
# Quick collection inspection
mongosh bap --eval 'db.identities.findOne({}, {field1: 1, field2: 1})'

# Count documents to verify data exists
mongosh bap --eval 'db.identities.countDocuments()'

# Check actual field names (critical for mapping)
mongosh bap --eval 'db.identities.findOne({}, {addresses: 1})'
```

**3. Type Definition Hunting**:
```bash
# Find schema definitions
grep -r "txId.*String" schemas/
grep -r "BapIdentity" types.ts bap.ts

# Find where types are used
grep -r "getSigners" --include="*.ts"
grep -r "AddressEntrySchema" --include="*.ts"
```

**4. Validation Schema Alignment**:
- Database fields may be optional/missing → Schema must reflect this
- Field name mismatches (e.g., `txid` vs `txId`) → Fix mapping, not fallbacks
- Security defaults (e.g., `valid: false`) → Explicit validation required

**5. Code Quality Maintenance**:
```bash
# Check and fix linting
bun run lint          # Identify issues
bun run lint:fix      # Auto-fix formatting
```

### Common Issue Patterns

**Validation Failures**:
1. **Missing Required Fields**: Make schema field optional if database doesn't guarantee it
2. **Field Name Mismatches**: Use correct database field names in mapping
3. **Type Mismatches**: Database may have `undefined` where schema expects `string`

**Security Considerations**:
- Always default `valid` fields to `false`
- Only set `valid: true` when explicitly validated
- Never use fallbacks for security-critical fields

**Database Field Mapping**:
```typescript
// ❌ Wrong - creates empty strings for missing fields
txId: addr.txid || ''

// ✅ Correct - preserves undefined, make schema optional
txId: addr.txid  // with t.Optional(t.String()) in schema
```

### Efficient CLI Debugging

**MongoDB Direct Access**:
```bash
# Quick data inspection
mongosh bap --eval 'db.identities.findOne()'

# Field-specific queries
mongosh bap --eval 'db.identities.findOne({}, {addresses: 1, valid: 1})'

# Collection listings
mongosh --eval 'show dbs'
mongosh bap --eval 'show collections'
```

**API Testing**:
```bash
# Test with error capture
curl "http://localhost:3055/endpoint" | jq .

# Specific field inspection
curl "http://localhost:3055/endpoint" | jq ".signers[0].addresses[0]"

# Check for errors vs success
curl "http://localhost:3055/endpoint" | jq ".error == null"
```

**Development Workflow**:
```bash
# Start development server
bun run build &

# Test changes immediately
curl "http://localhost:3055/endpoint"

# Check quality
bun run lint
```

### TypeScript & Elysia Debugging

**Schema-First Development**:
1. **Schema Definition**: Always start with TypeBox schema in `schemas/core.ts`
2. **Type Generation**: TypeScript types auto-generated from schemas
3. **Runtime Validation**: Elysia validates requests/responses against schemas
4. **Error Correlation**: Validation errors point to exact schema path

**Elysia Validation Error Patterns**:
```typescript
// Error format shows exact path and expected type
{
  "path": "/signers/0/addresses/0/txId",
  "message": "Expected required property",
  "expected": { "type": "string" }
}
```

**Schema Alignment Strategy**:
```typescript
// 1. Check what database actually contains
const sample = await db.collection('identities').findOne({}, {addresses: 1});

// 2. Make schema match reality, not ideal
export const AddressEntrySchema = t.Object({
  address: t.String(),
  txId: t.Optional(t.String()), // Optional if DB doesn't guarantee it
  block: t.Optional(t.Number()),
});

// 3. Map database fields correctly
addresses: (s.addresses || []).map((addr: DatabaseAddress) => ({
  address: addr.address || '',
  txId: addr.txid, // Use actual DB field name, undefined if missing
  block: addr.block,
}))
```

**Header Management in Elysia**:
```typescript
// ❌ Wrong - overwrites middleware headers (CORS, etc.)
set.headers = { 'Cache-Control': 'public, max-age=60' };

// ✅ Correct - preserves existing headers
Object.assign(set.headers, { 'Cache-Control': 'public, max-age=60' });
```

**Response Validation Requirements**:
- All schema fields must be present in response
- Optional fields need `t.Optional()` or explicit `null` values
- Missing required fields cause 422 validation errors
- Response validation is as strict as request validation

### File Organization & Code Navigation

**Finding Schema Definitions**:
```bash
# Core schemas (single source of truth)
schemas/core.ts          # Reusable components, identity, transactions
social/schemas.ts        # Social-specific schemas
analytics/schemas.ts     # Analytics-specific schemas

# Implementation files
bap.ts                   # BAP identity functions
queries/posts.ts         # Post query logic
social/routes.ts         # Social endpoint definitions
```

**Schema Import Strategy**:
```typescript
// Always import from core schemas first
import { BapIdentitySchema, PostsResponseSchema } from '../schemas/core.js';

// Use social/analytics schemas for feature-specific types
import type { Post, LikeRequest } from './schemas.js';
```

**Type Safety Enforcement**:
- No `any` types allowed - use explicit interfaces
- Database interfaces separate from API response types
- Runtime validation catches schema mismatches immediately
- Compile-time types prevent development errors

### Error Handling & Validation Patterns

**Validation Error Debugging Process**:
1. **Capture Full Error**: `curl endpoint | jq .error` to see complete validation details
2. **Identify Path**: Error path shows exact field location (e.g., `/signers/0/addresses/0/txId`)
3. **Check Database**: Verify field exists in database with correct name/type
4. **Fix Schema**: Make schema optional if field not guaranteed, fix field name mapping
5. **Test Fix**: Verify endpoint returns success without validation errors

**Common Validation Error Types**:
```bash
# Missing required field
"Expected required property" → Make field optional or ensure it's provided

# Type mismatch  
"Expected string but found undefined" → Fix field mapping or make optional

# Wrong field name
"Property not found" → Check database field names vs schema names
```

**Security-First Validation**:
```typescript
// Always default security fields to safe values
valid: s.valid === true,  // Only true if explicitly validated
encrypted: s.encrypted || false,  // Default to false for security
```

**Graceful Error Responses**:
```typescript
// Clean validation error formatting
export function formatValidationError(error: ValidationError): string {
  // Convert verbose validation errors to simple "field: message" format
  const field = error.path?.replace(/^\//, '').replace(/\//g, '.') || 'unknown';
  return `${field}: ${error.message}`;
}
```

**Elysia Error Handling Best Practices**:
```typescript
// Use proper error types
throw new NotFoundError('Resource not found');
throw new ValidationError('Invalid input data');
throw new ServerError('Internal processing error');

// Handle middleware errors gracefully
try {
  const result = await processData();
  return result;
} catch (error) {
  console.error('Processing error:', error);
  throw new ServerError('Failed to process request');
}
```

### Database-Schema Alignment Checklist

**Before Changing Schemas**:
1. ✅ Check actual database field names and types
2. ✅ Verify which fields are always present vs sometimes missing
3. ✅ Test with real data, not just empty collections
4. ✅ Consider security implications of default values

**Schema Change Process**:
1. **Database First**: Check what database actually contains
2. **Schema Second**: Make schema match database reality
3. **Mapping Third**: Update field mapping in implementation
4. **Test Fourth**: Verify endpoint works with real data
5. **Lint Last**: Fix any code style issues

**Field Mapping Rules**:
```typescript
// Database field → API field mapping
interface DatabaseAddress {
  address?: string;
  txid?: string;    // Database uses lowercase
  block?: number;
}

// Map to API response
{
  address: addr.address || '',
  txId: addr.txid,  // No fallback - let schema handle optionality
  block: addr.block,
}
```

## Data Architecture & Sources

### Hybrid Data Architecture

This project uses a **hybrid data architecture** with multiple data sources optimized for different operations:

**Read Operations** (Direct Database Access):
```
Client → BMAP API → MongoDB/Redis → Response
```

**Write Operations** (External API Delegation):
```
Client → BMAP API → External bsocial API → Response (proxy)
```

### Data Sources

**1. MongoDB Direct Access** (Primary Read Data):
- **Two MongoDB databases**:
  - `bsocial` (via `getDbo()`) - Transaction data, posts, likes, social features
  - `bap` (via `getBAPDbo()`) - BAP identity records and address mappings
- **Direct mongosh access** for debugging: `mongosh bap --eval 'query'`
- **MongoDB playground files** for testing complex queries

**2. External API Delegation** (Write Operations):
- **Transaction ingestion** delegated to `https://api.sigmaidentity.com/api/v1/ingest`
- **BMAP API acts as proxy** - forwards raw transactions to bsocial overlay API
- **Single source of truth** for transaction processing and indexing
- **Simplified architecture** - BMAP API is now primarily read-only

**3. Redis Caching Layer**:
- **High-performance caching** for frequently accessed data
- **Strategic TTL policies**: 30s-1h based on data volatility
- **Cached data types**: Transaction data, identities, social graph information

### Key Collections

**bsocial Database**:
- `bsocial.c` / `bsocial.u` - Confirmed/unconfirmed transactions
- `bsocial.post` - Post transactions and content
- `bsocial.like` - Like/reaction data
- `bsocial.follow` / `bsocial.unfollow` - Social graph relationships
- `bsocial.message` - Direct messages and channel communications

**bap Database**:
- `bap.identities` - BAP identity records with addresses, profiles

### Database Schema Notes

**Field Naming Conventions**:
- Address records use `txid` (lowercase) not `txId` in database
- Some fields may be missing/optional in database records
- Always handle undefined/null database fields gracefully
- Security: `valid` field defaults to false - only true if explicitly validated

**Architectural Benefits**:
- **Performance**: Direct MongoDB access for fast reads
- **Simplicity**: External API handles complex transaction processing
- **Consistency**: Single source of truth for transaction ingestion
- **Separation of Concerns**: Read API vs. write processing clearly separated

## Architecture

### Single Source of Truth Design

**Elysia Route Definitions → Everything Else**

This project implements a "route-first" architecture where:

1. **Elysia route definitions** (with TypeBox schemas) are authoritative
2. **All documentation is generated** from actual route implementations
3. **Types package** auto-generated from source schemas
4. **README and docs** stay in sync automatically

### Technology Stack

- **Runtime**: Bun (high-performance JavaScript/TypeScript)
- **Framework**: Elysia.js (type-safe, fast web framework)
- **Database**: MongoDB (transaction storage, social data)
- **Cache**: Redis (high-performance caching layer)
- **Validation**: TypeBox (runtime schema validation + compile-time types)
- **Identity**: BAP (Bitcoin Attestation Protocol)
- **Charts**: Chart.js with @napi-rs/canvas

## API Inventory

### Current Endpoints (35 Total)

**Transaction Processing** (2 endpoints)
- `POST /ingest` - Process raw Bitcoin transactions
- `GET /tx/:tx/:format?` - Get transaction details

**Database Queries** (2 endpoints)  
- `GET /q/:collectionName/:base64Query` - Execute MongoDB queries
- `GET /s/:collectionName/:base64Query` - Real-time SSE subscriptions

**Chart Data** (1 endpoint)
- `GET /chart-data/:name?` - Time-series visualization data

**Social Features** (17 endpoints)
- Channel communication (2)
- Identity & search (3) 
- Posts & content (6)
- Social graph (2)
- Direct messages (2)
- Feed (1)
- Likes (1)

**Analytics & Intelligence** (12 endpoints)
- Network overview (3)
- Trending analysis (2)
- Content analytics (2)
- User insights (1)
- Administrative (2)
- Real-time streams (1)
- Health monitoring (1)

**Health Monitoring** (1 endpoint)
- `GET /health/network/status` - System health checks

## Implementation Highlights

### Phase 1 Analytics ✅ COMPLETE

Built comprehensive analytics suite with:
- **Global network statistics** (users, messages, growth rates)
- **Trending algorithms** for channels and content
- **Real-time activity feeds** with filtering
- **Time-series growth data** with multiple timeframes
- **Admin dashboards** with system health
- **Export capabilities** (CSV, JSON, XLSX)
- **Alert monitoring** with threshold checking

### Social Network Features ✅ COMPLETE

Full-featured social platform with:
- **BAP identity integration** for user management
- **Channel-based messaging** with real-time updates
- **Direct messaging** with conversation threading
- **Social graph** (friends, followers, likes)
- **Content discovery** (search, trending, feeds)
- **Post interactions** (likes, replies, reactions)

### Performance Optimizations

**Caching Strategy**:
- Redis TTLs: 30s-1h based on data volatility
- Route-level cache headers 
- Smart cache invalidation
- Performance: Sub-100ms for cached endpoints

**Database Design**:
- MongoDB aggregation pipelines for complex queries
- Strategic indexing on frequently queried fields
- Connection pooling and optimization

## Identity System Architecture

### Three Distinct Identity Formats

The API handles three different identity types that must not be confused:

**BAP IDs**:
- Derived identity strings (e.g., "Go8vCHAa4S6AhXKTABGpANiz35J")
- 26 characters of base58-encoded data
- Unique identifier for a BAP identity (NOT a public key or address)
- Used in social features and message routing

**Bitcoin Addresses**:
- Legacy format (e.g., "1CfG7EzS1Qj8vGxKzr2ecHhYqZh2ndJT9g")
- Found in AIP protocol data as `address` or `algorithm_signing_component` fields
- Used for transaction signing and verification

**Public Keys**:
- 33 or 65 byte hex strings for encryption/decryption
- Not directly exposed in API responses
- Derived from BAP identity when needed

## Development Workflow

### Code Generation Scripts

1. **`scripts/build-types.ts`** - Auto-generate types package
   - Extracts TypeScript types from all schema files
   - Creates publishable `@bmap/types` npm package
   - Maintains build-time sync with source code

2. **`scripts/audit-routes.ts`** - Route consistency auditing
   - Validates all 35 routes have proper schemas
   - Checks documentation completeness  
   - Reports schema usage and inconsistencies

3. **`scripts/test-redis.ts`** - Redis connectivity testing
4. **`scripts/migrate-b-data-to-content.ts`** - Database migration utilities

### Quality Assurance

**Type Safety**:
- 100% TypeScript with strict typing
- No `any` types allowed - use explicit types
- Runtime validation with TypeBox schemas
- Compile-time types derived from schemas

**Code Quality**:
- Biome for linting and formatting
- Git hooks for pre-commit checks
- Automatic type generation prevents drift

**Testing**:
- All endpoints tested via Swagger UI
- Redis connectivity testing script
- MongoDB query validation

## Project Structure

```
bmap-api/
├── index.ts                 # Main entry point & route registration
├── analytics/               # Analytics suite (Phase 1)
│   ├── routes.ts           # 13 analytics endpoints  
│   ├── queries.ts          # Database query functions
│   └── schemas.ts          # TypeBox schemas + types
├── social/                 # Social networking features
│   ├── routes.ts          # 17 social endpoints
│   ├── queries/           # Social query functions
│   └── swagger/           # OpenAPI documentation
├── routes/                 # Core API routes
│   ├── transaction.ts     # Bitcoin transaction handling
│   ├── query.ts          # MongoDB query interface  
│   └── chart.ts          # Chart data generation
├── packages/types/        # Auto-generated types package
├── scripts/               # Code generation & audit tools
├── config/               # Configuration management
├── middleware/           # Error handling & utilities
└── schemas/             # Legacy schema files
```

## Key Technical Decisions

### Schema Management

**TypeBox Integration**:
- Runtime validation of all requests/responses
- Automatic TypeScript type generation
- OpenAPI/Swagger schema generation
- Type-safe route definitions in Elysia

**Schema Categories**:
- `analytics/schemas.ts` - Analytics endpoint schemas
- `social/schemas.ts` - Social feature schemas  
- `common/types.ts` - Shared utility types
- Generated types automatically exported

### Route Organization

**Modular Route Groups**:
- Each feature area has dedicated route file
- Proper route prefixes (`/social`, `/analytics`, `/health`)
- Consistent error handling across all routes
- Standardized response formats

### Performance Architecture

**Caching Patterns**:
```typescript
// Route-level caching
Object.assign(set.headers, {
  'Cache-Control': 'public, max-age=60'
});

// Redis caching with TTL
await client.setEx(cacheKey, 300, JSON.stringify(data));
```

**Database Optimization**:
- Aggregation pipelines for complex queries
- Strategic MongoDB indexes
- Connection pooling

## Environment Setup

### Required Variables

```bash
API_HOST=0.0.0.0
API_PORT=3000
REDIS_PRIVATE_URL=redis://localhost:6379
BMAP_MONGO_URL=mongodb://localhost:27017/bmap
```

### Development Commands

```bash
# Start development server
bun run dev

# Type checking
bun run typecheck

# Linting  
bun run lint                    # Check code quality
bun run lint:fix               # Auto-fix formatting
bun run lint:unsafe            # Apply unsafe auto-fixes

# Type generation and publishing
bun run build:types           # Generate types package
bun run publish:types         # Publish to npm
bun run publish:types:dry     # Dry run publish

# Testing and utilities
bun run test-redis           # Test Redis connectivity
bun run migrate:b-data       # Database migration utilities
bun run prepare-hooks        # Install git hooks
```

### Elysia Framework Specifics

**Header Management** (Critical for middleware compatibility):
```typescript
// ❌ Wrong - overwrites CORS and other middleware headers
set.headers = { 'Cache-Control': 'public, max-age=60' };

// ✅ Correct - preserves existing headers
Object.assign(set.headers, { 'Cache-Control': 'public, max-age=60' });
```

**Response Validation Requirements**:
- All schema fields must be present in response
- Optional fields need `t.Optional()` or explicit `null` values
- Missing required fields cause 422 validation errors
- Response validation is as strict as request validation

**Route Parameter Handling**:
```typescript
// Use typed route parameters
context.params.bapId

// Handle query parameters  
context.query.page

// Process request body
context.body.rawTx

// Set response status
set.status = 404
```

## Production Deployment

### Readiness Checklist

- [x] All 35 endpoints functional and tested
- [x] TypeScript compilation successful
- [x] Linting passes (Biome)
- [x] Redis caching implemented
- [x] MongoDB queries optimized
- [x] Error handling standardized
- [x] API documentation complete
- [x] Types package generated
- [x] Health monitoring endpoint
- [x] Performance optimizations applied

### Performance Metrics

- **Response times**: Sub-100ms for cached endpoints
- **Cache hit rates**: 85%+ for frequently accessed data
- **Database queries**: Optimized with aggregation pipelines
- **Memory usage**: Efficient with connection pooling

## Future Roadmap

### Phase 2 Enhancements

- **GraphQL endpoint generation** from existing schemas
- **Advanced real-time features** (WebSocket subscriptions)
- **Enhanced analytics dashboards** with visualizations
- **API rate limiting** and authentication
- **Automated testing suite** with full coverage

### Architecture Evolution

- **Microservice decomposition** for horizontal scaling
- **Event-driven architecture** for real-time updates
- **Advanced caching strategies** with cache warming
- **Performance monitoring** and observability

## Integration Notes

### API Consumption

The API is designed for:
- Frontend applications (React, Vue, etc.)
- Mobile applications via REST endpoints
- Real-time applications via SSE streams
- Analytics dashboards and business intelligence
- Third-party integrations via comprehensive OpenAPI spec

### BAP Integration

Bitcoin Attestation Protocol features:
- Identity resolution from Bitcoin addresses
- Cryptographic signature verification
- Social graph built on blockchain identities
- Decentralized identity management

---

**Generated**: December 2024  
**Total Routes**: 35  
**Implementation Status**: Production Ready  
**Architecture**: Single Source of Truth from Elysia Routes