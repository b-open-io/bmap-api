# BMAP API

A high-performance Bitcoin transaction processing and social features API built with Bun, Elysia, MongoDB, and Redis.

## Overview

The BMAP API provides comprehensive Bitcoin SV transaction processing capabilities combined with social networking features. It processes blockchain data in real-time, offers analytics insights, and enables social interactions through BAP (Bitcoin Attestation Protocol) identities.

## Features

- **Real-time Transaction Processing**: Process and store Bitcoin transactions using bmapjs
- **Social Network Features**: Friends, channels, direct messaging, posts, and likes
- **Analytics Dashboard**: Network statistics, trending content, and growth metrics  
- **Identity Management**: BAP identity integration and search
- **Chart Data Generation**: Time-series data for visualization
- **MongoDB Query Interface**: Flexible database querying with real-time subscriptions
- **High Performance**: Built on Bun runtime with Redis caching

## API Endpoints

### Transaction Processing

- `POST /ingest` - Process and store raw Bitcoin transaction
- `GET /tx/:tx/:format?` - Get transaction details in various formats (bmap, bob, raw, signer, json)

### Database Queries

- `GET /q/:collectionName/:base64Query` - Execute MongoDB queries with text search support
- `GET /s/:collectionName/:base64Query` - Subscribe to real-time query updates (SSE)

### Chart Data

- `GET /chart-data/:name?` - Generate time series chart data

### Social Features

**Channel Communication**
- `GET /social/channels` - List all channels
- `GET /social/channels/:channelId/messages` - Get channel messages

**Identity & Search**
- `GET /social/autofill` - Autocomplete search (identities + posts)
- `GET /social/identity/search` - Search identities
- `GET /social/identities` - List all identities with pagination

**Posts & Content**
- `GET /social/post/:txid` - Get post with metadata
- `GET /social/post/:txid/reply` - Get replies to a post
- `GET /social/post/:txid/like` - Get likes for a post
- `GET /social/post/search` - Search posts
- `GET /social/post/address/:address` - Posts by Bitcoin address
- `GET /social/post/bap/:bapId` - Posts by BAP identity
- `GET /social/feed/:bapId?` - Get user feed

**Social Graph**
- `GET /social/friend/:bapId` - Friend relationships
- `GET /social/bap/:bapId/like` - User's likes
- `POST /social/likes` - Get likes for transactions or messages

**Direct Messages**
- `GET /social/@/:bapId/messages` - User's DM conversations
- `GET /social/@/:bapId/messages/:targetBapId` - Specific conversation

### Analytics & Intelligence

**Network Overview**
- `GET /analytics/network/overview` - Global network statistics
- `GET /analytics/network/activity` - Real-time activity feed
- `GET /analytics/network/growth` - Time-series growth data

**Trending Analysis**
- `GET /analytics/trending/channels` - Most active channels
- `GET /analytics/trending/users` - Top users by engagement

**Content Analytics**
- `GET /analytics/content/analytics` - Content overview and metrics
- `GET /analytics/content/trending` - Trending content analysis

**User Insights**
- `GET /analytics/user/:userId/metrics` - Comprehensive user analytics

**Administrative**
- `GET /analytics/admin/stats` - Administrative dashboard statistics
- `GET /analytics/export` - Export analytics data (CSV, JSON, XLSX)
- `POST /analytics/alerts/check` - Check alert thresholds

**Real-time Streams**
- `GET /analytics/stream/:stream` - Live analytics data streams

### Health Monitoring

- `GET /health/network/status` - System health and status indicators

## Response Formats

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

**Error Response**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd bmap-api

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the development server
bun run dev

# View API documentation
open http://localhost:3000/docs
```

## Environment Variables

```
API_HOST=0.0.0.0
API_PORT=3000
REDIS_PRIVATE_URL=redis://localhost:6379
BMAP_MONGO_URL=mongodb://localhost:27017/bmap
```

## Documentation

- **Swagger/OpenAPI**: Available at `/docs` when running
- **Schema Types**: Published as `@bmap/types` npm package
- **Project Documentation**: See [CLAUDE.md](./CLAUDE.md)

## Development

```bash
# Type checking
bun run typecheck

# Linting
bun run lint
bun run lint:fix

# Build types package
bun run build:types

# Run tests
bun test
```

## Architecture

- **Runtime**: Bun for high-performance JavaScript/TypeScript execution
- **Framework**: Elysia.js for type-safe web framework
- **Database**: MongoDB for transaction storage and querying
- **Cache**: Redis for high-performance caching
- **Validation**: TypeBox for runtime schema validation
- **Identity**: BAP (Bitcoin Attestation Protocol) integration

## Key Statistics

- **Total API Endpoints**: 35
- **Route Categories**: 6 (Transactions, Social, Analytics, Health, Queries, Charts)
- **TypeBox Schemas**: Comprehensive runtime validation
- **Caching Strategy**: Redis with optimized TTLs
- **Performance**: Sub-100ms response times for cached endpoints

## Contributing

1. Follow TypeScript best practices
2. Use TypeBox for all schema definitions  
3. Add comprehensive tests for new endpoints
4. Update documentation when adding routes
5. Run linting and type checking before commits

## License

MIT