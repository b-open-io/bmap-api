# Analytics Module

This module provides comprehensive network analytics and monitoring capabilities for the BMAP API. It's organized into three main components:

## Structure

```
analytics/
├── README.md          # This documentation
├── schemas.ts         # TypeBox schemas and TypeScript types
├── queries.ts         # Database query functions
└── routes.ts          # Elysia route definitions
```

## Features

### Phase 1: Core Network Analytics ✅ IMPLEMENTED

#### 1. `/analytics/network/overview`
Global network statistics and overview metrics:
- Total users, active users (24h/7d)
- Total messages, channels, transactions, posts
- Average connections per user
- Network growth rates
- **Cache**: 1 minute

#### 2. `/analytics/trending/channels`
Most active channels with engagement metrics:
- Channel activity analysis (24h/7d/30d timeframes)
- Messages per hour, active users
- Trending score calculation
- **Cache**: 5 minutes

#### 3. `/health/network/status`
Real-time system health monitoring:
- Database, Redis, blockchain connectivity
- API response times
- Active connections
- **Cache**: 30 seconds

### Phase 2: Activity & Growth Analytics ✅ IMPLEMENTED

#### 4. `/analytics/network/activity`
Real-time global activity feed:
- Recent messages, posts, transactions
- Filterable by activity type
- Pagination support
- **Cache**: 30 seconds

#### 5. `/analytics/network/growth`
Time-series growth data:
- User, message, channel, transaction growth
- Multiple timeframes (7d/30d/90d/1y)
- Daily data points with new counts
- **Cache**: 1 hour

#### 6. `/analytics/admin/stats`
Administrative dashboard statistics:
- User stats (total, active, new registrations)
- Content stats (posts, messages, flagged content)
- System health metrics
- **Cache**: 5 minutes

## Usage Examples

### Network Overview
```bash
curl http://localhost:3000/analytics/network/overview
```

### Trending Channels (last 7 days, top 10)
```bash
curl "http://localhost:3000/analytics/trending/channels?timeframe=7d&limit=10"
```

### Network Activity (last 20 messages)
```bash
curl "http://localhost:3000/analytics/network/activity?type=message&limit=20"
```

### Growth Data (users over 30 days)
```bash
curl "http://localhost:3000/analytics/network/growth?timeframe=30d&metric=users"
```

### Trending Users (by engagement, last 7 days)
```bash
curl "http://localhost:3000/analytics/trending/users?timeframe=7d&metric=engagement&limit=15"
```

### User Metrics (30-day analysis)
```bash
curl "http://localhost:3000/analytics/user/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa/metrics?timeframe=30d"
```

### Content Analytics (posts over 7 days)
```bash
curl "http://localhost:3000/analytics/content/analytics?type=posts&timeframe=7d&limit=25"
```

### Trending Content (by engagement, last 24h)
```bash
curl "http://localhost:3000/analytics/content/trending?type=posts&timeframe=24h&metric=engagement&limit=15"
```

### System Health Check
```bash
curl http://localhost:3000/health/network/status
```

### Admin Dashboard Stats
```bash
curl http://localhost:3000/analytics/admin/stats
```

### Real-time Stream (network activity)
```bash
curl "http://localhost:3000/analytics/stream/network-activity?filters={\"limit\":10,\"type\":\"message\"}"
```

### Export Data (CSV format)
```bash
curl "http://localhost:3000/analytics/export?endpoint=network/overview&format=csv"
```

### Check Alerts
```bash
curl -X POST "http://localhost:3000/analytics/alerts/check" \
  -H "Content-Type: application/json" \
  -d '[{"id":"alert1","metric":"activeUsers24h","threshold":100,"condition":"below","enabled":true}]'
```

## Implementation Details

### Caching Strategy
- Redis-based caching with appropriate TTLs
- Cache keys follow pattern: `analytics:{category}:{endpoint}:{params}`
- Health endpoints have shorter cache times for real-time monitoring

### Database Queries
- Optimized MongoDB aggregation pipelines
- Uses `estimatedDocumentCount()` for performance
- Proper indexing on timestamp fields recommended

### Response Types
- All endpoints return strict TypeScript types
- Proper error handling with detailed messages
- Consistent response formats across all endpoints

### Performance Considerations
- Aggregation pipelines use `$match` early for filtering
- Time-based queries use Unix timestamps
- Limited result sets with configurable limits

## Future Enhancements

### Phase 3: User Analytics ✅ IMPLEMENTED

#### 7. `/analytics/trending/users`
Most active and followed users with engagement metrics:
- User ranking by messages, followers, or engagement
- Activity metrics (messages, posts, channels)
- Recent activity tracking
- Trend score calculation
- **Cache**: 5 minutes

#### 8. `/analytics/user/{userId}/metrics`
Comprehensive analytics for individual users:
- Activity metrics (messages, posts, channels)
- Social metrics (followers, following, connections)
- Engagement metrics (replies, likes, participation)
- Growth trends and performance indicators
- **Cache**: 10 minutes

### Phase 4: Content Analytics ✅ IMPLEMENTED

#### 9. `/analytics/content/analytics`
Comprehensive content analytics with overview, top content, and trends:
- Content performance metrics (views, likes, engagement)
- Top performing content by engagement score
- Growth trends and popular tags
- Support for posts, messages, and media content types
- **Cache**: 15 minutes

#### 10. `/analytics/content/trending`
Trending content ranked by various metrics:
- Content ranking by views, likes, or engagement
- Detailed metrics for each content item
- Trend score calculation with weighted factors
- Content metadata including creator, title, description
- **Cache**: 10 minutes

### Phase 5: Advanced Features ✅ IMPLEMENTED

#### 11. `/analytics/stream/{stream}`
Real-time streaming of analytics data via Server-Sent Events:
- Live updates for network activity, trending channels, user metrics, content analytics
- WebSocket-style streaming with heartbeat and error handling
- Configurable filters for each stream type
- **Update Interval**: 30 seconds

#### 12. `/analytics/export`
Export analytics data in multiple formats:
- Support for CSV, JSON, and XLSX formats
- Export any analytics endpoint with applied filters
- Automatic filename generation with timestamps
- **Formats**: CSV, JSON, XLSX

#### 13. `/analytics/alerts/check`
Alert threshold monitoring and notifications:
- Check multiple alert configurations in batch
- Support for above/below threshold conditions
- Monitoring of key metrics (active users, error rates, response times)
- **Alert Types**: activeUsers24h, totalMessages, errorRate, apiResponseTime

## Error Handling
All endpoints include comprehensive error handling:
- Database connection failures
- Redis cache failures
- Invalid parameters
- Rate limiting (if implemented)

## Monitoring
The analytics module itself can be monitored via:
- Response times in `/health/network/status`
- Error rates tracked in admin stats
- Cache hit/miss ratios
- Database query performance

## Integration
The analytics module integrates with:
- Main BMAP API (`index.ts`)
- Social features (`/social/routes.ts`)
- Chart generation (`chart.ts`)
- BAP identity system (`bap.ts`)

## API Tags
Endpoints are properly tagged for Swagger documentation:
- `analytics` - Main analytics endpoints
- `health` - System health monitoring 