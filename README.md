# BMAP API

A high-performance Bitcoin SV transaction processing and serving API built with Bun and Elysia.js. This service processes Bitcoin transactions, provides social features (friends, likes, channels), caching, and real-time updates via Server-Sent Events (SSE).

## Features

- **Transaction Processing**: Ingest and store Bitcoin transactions with MongoDB and Redis caching
- **Social Features**: Complete social graph with friends, identities, likes, and messaging
- **Real-time Updates**: Stream Bitcoin transactions via JungleBus and SSE
- **Dynamic Charts**: Generate transaction visualizations using Chart.js
- **BAP Integration**: Bitcoin Attestation Protocol identity management
- **High Performance**: Built with Bun runtime and Elysia.js framework
- **API Documentation**: Interactive Swagger/OpenAPI documentation
- **Native TypeScript**: Direct TypeScript execution with Bun
- **Comprehensive Logging**: File-based logging with rotation and compression
- **Error Handling**: Standardized error responses with proper HTTP status codes

## Prerequisites

- [Bun](https://bun.sh) runtime
- MongoDB instance
- Redis instance

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd bmap-api
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
- `REDIS_PRIVATE_URL`: Redis connection string
- `BMAP_MONGO_URL`: MongoDB connection URL

## Development

Start the development server with hot reload:
```bash
bun run dev
```

The server will start at `http://localhost:3055`. You can access:
- API at `http://localhost:3055/`
- Swagger documentation at `http://localhost:3055/docs`

### Scripts

- `bun run dev`: Run development server with hot reload
- `bun run start`: Run production server
- `bun run typecheck`: Run TypeScript type checking
- `bun run lint`: Run Biome checks
- `bun run lint:fix`: Auto-fix Biome issues
- `bun run test-redis`: Test Redis connectivity

### AI Assistant Integration

This project includes a `CLAUDE.md` file that provides context and guidance for AI assistants (like Claude) when working with this codebase. This helps maintain consistency and best practices across AI-assisted development sessions.

## Architecture Overview

### Current Structure (Post-Refactoring)

The codebase has been significantly refactored for better maintainability, consistency, and performance:

```
/
├── index.ts                    # Main entry point with core transaction APIs
├── social/                     # Social features module
│   ├── routes.ts              # All social API endpoints
│   ├── schemas.ts             # Consolidated TypeScript interfaces and TypeBox schemas
│   ├── queries/               # Database query functions
│   └── swagger/               # Swagger documentation per feature
├── config/                    # Configuration management
│   └── constants.ts           # All magic numbers, URLs, and configuration
├── middleware/                # Reusable middleware
│   └── errorHandler.ts        # Standardized error handling
├── queries/                   # Core query functions (posts, messages)
├── schemas/                   # Legacy schema files (being phased out)
├── public/                    # Static assets
├── logger.ts                  # Logging system with file rotation
├── cache.ts                   # Redis caching utilities
├── bap.ts                     # Bitcoin Attestation Protocol integration
├── process.ts                 # Transaction processing logic
├── chart.ts                   # Chart generation for visualizations
├── htmx.ts                    # HTMX routes for dynamic UI
└── db.ts                      # MongoDB connection and utilities
```

### Key Architectural Improvements

1. **Centralized Configuration**
   - All constants moved to `/config/constants.ts`
   - No more hardcoded values scattered throughout codebase
   - Environment-specific settings properly managed

2. **Standardized Error Handling**
   - Custom error classes (`NotFoundError`, `ValidationError`, `ServerError`)
   - Consistent error response format across all endpoints
   - Proper HTTP status codes and error messages

3. **Schema Consolidation**
   - All TypeScript interfaces and TypeBox schemas in `/social/schemas.ts`
   - Consolidated schema definitions into single 587-line file
   - Better type safety and consistency with accurate API response types

4. **Optimized Database Queries**
   - Extracted duplicate aggregation pipeline logic into reusable functions
   - `createPostMetaPipeline()` and `normalizePost()` helpers
   - Reduced code duplication in posts queries

5. **Improved Logging**
   - File-based logging with automatic rotation (10MB files, keep last 5)
   - Gzip compression for archived logs
   - Structured logging format with timestamps

### API Structure Analysis

#### Strengths

✅ **Well-Organized Social Features**
- Clean separation of social functionality in `/social/` directory
- Comprehensive social graph features (friends, likes, channels, DMs)
- Good use of TypeBox for request/response validation

✅ **Comprehensive Caching Strategy**
- Redis caching for transactions, identities, and social data
- Smart cache invalidation patterns
- Performance-optimized cache keys

✅ **Real-time Capabilities**
- WebSocket support for messaging
- Server-Sent Events for transaction streaming
- JungleBus integration for live blockchain data

✅ **Good Documentation**
- Interactive Swagger UI with detailed endpoint documentation
- Well-documented API responses and error codes
- Examples and schema definitions

#### Areas for Improvement

🔄 **Query Optimization Needed**
- Some N+1 query patterns in likes endpoints
- Missing database indexes configuration
- Duplicate signer resolution logic could be extracted

🔄 **Input Validation**
- Missing query parameter validation schemas
- Some endpoints lack proper input sanitization
- Need to standardize validation patterns

🔄 **API Consistency**
- Mixed response formats between core and social endpoints
- Some endpoints return arrays, others return wrapped objects
- Need to standardize pagination patterns

### Data Storage

**MongoDB Collections**:
- `post`: Blog posts and content
- `like`: Like/reaction data with emoji support
- `message`: Channel and direct messages
- `follow`/`unfollow`: Social graph relationships
- `identities`: BAP identity data
- `c`: Confirmed transactions
- `u`: Unconfirmed transactions

**Redis Caching Patterns**:
```
tx:{txid}                    # Transaction data
identity:{bapId}             # BAP identity information
messages:{channel}:{page}    # Channel messages
signer-{address}             # Signer cache
autofill                     # Search autocomplete cache
```

### Core Components

1. **Transaction Processing** (`process.ts`)
   - Bitcoin transaction ingestion and normalization
   - BMAP protocol support
   - Automatic collection routing

2. **Caching Layer** (`cache.ts`)
   - Redis wrapper with TTL management
   - Type-safe cache operations
   - Automatic serialization/deserialization

3. **Social Features** (`/social/`)
   - Friends/followers management
   - Like system with emoji reactions
   - Channel-based messaging
   - Direct messaging with encryption support

4. **BAP Integration** (`bap.ts`)
   - Bitcoin Attestation Protocol identity resolution
   - Address-to-identity mapping
   - Signer resolution for transactions

5. **Chart Generation** (`chart.ts`)
   - Dynamic visualization creation
   - Time series data processing
   - Custom chart parameters

## API Documentation

### Core Endpoints

#### Transaction APIs (Main Routes)
- `GET /tx/:txid` - Get transaction by ID
- `GET /post/:postId` - Get specific post
- `GET /bap/:txid` - Get BAP data for transaction
- `GET /chart/:type` - Generate charts
- `GET /explorer/:collection` - Visual query builder

#### Social APIs (All require `/social` prefix)

**Channel Communication**
- `GET /social/channels` - List all channels
- `GET /social/channels/:channelId/messages` - Channel messages (⚠️ Recently fixed to return `{results, signers}`)

**Identity & Search**
- `GET /social/autofill?q=` - Autocomplete search (identities + posts)
- `GET /social/identity/search?q=` - Search identities
- `GET /social/identities` - List all identities with pagination

**Posts & Content**
- `GET /social/post/:txid` - Get post with metadata (likes, replies, reactions)
- `GET /social/post/:txid/reply` - Get replies to a post
- `POST /social/post/:txid/like` - Like/react to a post
- `GET /social/post/search?q=` - Search posts
- `GET /social/post/address/:address` - Posts by Bitcoin address
- `GET /social/post/bap/:bapId` - Posts by BAP identity

**Social Graph**
- `GET /social/friend/:bapId` - Friend relationships
- `GET /social/bap/:bapId/like` - User's likes

**Direct Messages**
- `GET /social/@/:bapId/messages` - User's DM conversations
- `GET /social/@/:bapId/messages/:targetBapId` - Specific conversation
- `WS /social/@/:bapId/messages/listen` - Real-time DM listening

### Response Formats

**Standard Success Response**:
```json
{
  "status": "OK",
  "result": { ... }
}
```

**Paginated Response**:
```json
{
  "page": 1,
  "limit": 100,
  "count": 250,
  "results": [...],
  "signers": [...]
}
```

**Error Response** (Standardized):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

## Development Guidelines

### Code Quality Standards

1. **TypeScript First**
   - Strict typing with proper interfaces
   - No `any` types (use `unknown` when necessary)
   - Comprehensive type definitions in `/social/schemas.ts`

2. **Error Handling**
   - Use custom error classes (`NotFoundError`, `ValidationError`, `ServerError`)
   - Never return raw errors to clients
   - Log errors with appropriate context

3. **Performance**
   - Use Redis caching appropriately
   - Implement database indexes
   - Avoid N+1 queries
   - Use aggregation pipelines for complex queries

4. **API Design**
   - Follow RESTful conventions
   - Use consistent response formats
   - Document all endpoints with Swagger
   - Validate input parameters

5. **Database Patterns**
   - Use the helper functions for common queries
   - Leverage `createPostMetaPipeline()` for post metadata
   - Use `normalizePost()` for consistent post formatting
   - Cache frequently accessed data

### Common Patterns

**Database Query with Caching**:
```typescript
const cacheKey = `prefix:${id}:${page}:${limit}`;
const cached = await readFromRedis<CacheValue>(cacheKey);

if (cached?.type === 'expected-type') {
  return cached.value;
}

// Perform database query
const result = await db.collection().aggregate(pipeline).toArray();

await saveToRedis<CacheValue>(cacheKey, {
  type: 'expected-type',
  value: result,
});

return result;
```

**Error Handling**:
```typescript
try {
  // ... operation
} catch (error) {
  if (error instanceof NotFoundError) {
    throw error; // Re-throw known errors
  }
  throw new ServerError('Operation failed');
}
```

## Testing

Currently testing is manual via Swagger UI. Future improvements should include:
- Unit tests for utility functions
- Integration tests for API endpoints
- Performance testing for database queries
- Redis connectivity testing

## Contributing

1. Fork the repository
2. Create your feature branch
3. Follow the coding standards
4. Run quality checks:
   ```bash
   bun run typecheck
   bun run lint
   ```
5. Test your changes via Swagger UI
6. Submit a pull request

## Known Issues & Technical Debt

1. **Schema Coverage**: ~60% of endpoints lack response schemas for Swagger documentation
2. **Query Optimization**: Some endpoints have N+1 query patterns
3. **Input Validation**: Missing schemas for query parameters
4. **Database Indexes**: Not all collections have optimal indexes
5. **API Consistency**: Mixed response formats across endpoints
6. **Testing**: No automated test suite

### Swagger Documentation Status

✅ **The Swagger documentation is now significantly more accurate** after comprehensive testing and fixes:

**Recently Fixed:**
- ✅ Channel messages endpoint (`/channels/:channelId/messages`) - Fixed response format regression
- ✅ Social routes mounting - Added proper `/social` prefix grouping
- ✅ Identities endpoint (`/social/identities`) - Fixed schema to match actual response structure
- ✅ Post endpoints schema coverage (partial)

**Working Endpoints:**
- ✅ `/docs` - Swagger UI loads properly
- ✅ `/social/channels` - Returns 100+ channels
- ✅ `/social/identities` - Returns identity data with proper schema validation
- ✅ `/social/channels/:channelId/messages` - Returns `{results: [], signers: []}` format

**Still Missing Schemas:**
- ❌ Core transaction endpoints (`/tx/:txid`, `/bap/:txid`)
- ❌ Some social endpoints (`/friend/:bapId`, search endpoints)

See `SCHEMA_AUDIT.md` for detailed testing report.

## License

[Add License Information]

## Support

[Add Support Information]