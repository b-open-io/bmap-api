# bmap-api-types

TypeScript types for the BMAP API - Bitcoin SV transaction processing and analytics platform.

## Installation

```bash
npm install bmap-api-types
# or
yarn add bmap-api-types
# or
pnpm add bmap-api-types
```

## Usage

### Basic Types

```typescript
import type {
  BMAPTransaction,
  BAPIdentity,
  Post,
  Message,
  Friend,
  Like
} from 'bmap-api-types';

// Use in your client application
const processTransaction = (tx: BMAPTransaction) => {
  console.log(`Processing transaction: ${tx.tx.h}`);
  if (tx.MAP) {
    tx.MAP.forEach(mapData => {
      console.log(`MAP type: ${mapData.type}`);
    });
  }
};
```

### Analytics Types

```typescript
import type {
  NetworkOverviewResponse,
  TrendingChannelsResponse,
  ContentAnalyticsResponse,
  UserMetricsResponse
} from 'bmap-api-types';

// Perfect for client libraries
const fetchNetworkStats = async (): Promise<NetworkOverviewResponse> => {
  const response = await fetch('/analytics/network/overview');
  return response.json();
};
```

### Social Features

```typescript
import type {
  FriendRequest,
  LikeResponse,
  IdentityData,
  PostSearchResponse
} from 'bmap-api-types';

// Type-safe social interactions
const sendFriendRequest = async (friend: FriendRequest) => {
  // Your implementation
};
```

### API Integration

```typescript
import type {
  QueryRequest,
  QueryResponse,
  TransactionIngest,
  SearchParams,
  ChartRequest
} from 'bmap-api-types';

// Type-safe API client
class BMAPClient {
  async query<T>(params: QueryRequest): Promise<QueryResponse<T>> {
    // Implementation
  }
  
  async ingestTransaction(tx: TransactionIngest): Promise<TransactionResponse> {
    // Implementation
  }
}
```

## Type Categories

### Core Types (`/core`)
- **BMAPTransaction** - Base transaction structure with AIP, B, MAP data
- **BAPIdentity** - Bitcoin Attestation Protocol identity
- **Post, Message** - Content types with engagement metrics
- **Friend, Like** - Social interaction types
- **QueryParams, QueryResponse** - Database query interfaces

### Analytics Types (`/analytics`)
- **Network Analytics** - Overview, growth, health monitoring
- **User Analytics** - Individual and trending user metrics
- **Content Analytics** - Post, message, and media performance
- **Streaming** - Real-time data streaming interfaces
- **Export & Alerts** - Data export and monitoring types

### Social Types (`/social`)
- **Friend Management** - Friend requests, lists, status
- **Like System** - Reactions, emoji support
- **Identity Search** - User discovery and resolution
- **Post Search** - Content discovery and filtering
- **Notifications** - Social interaction alerts

### API Types (`/api`)
- **Query API** - MongoDB query interfaces
- **Transaction API** - TX ingestion and processing
- **Search API** - Full-text search with faceting
- **Chart API** - Data visualization requests
- **Health & Rate Limiting** - System monitoring

### Common Types (`/common`)
- **Enums** - Timeframe, ContentType, MetricType, etc.
- **Pagination** - Standard pagination interfaces
- **Utility Types** - Timestamps, caching, responses

## Features

✅ **Complete Coverage** - All BMAP API endpoints typed
✅ **Strict Types** - No `any` types, full type safety
✅ **Tree Shakeable** - Import only what you need
✅ **Backwards Compatible** - Semantic versioning
✅ **Well Documented** - JSDoc comments throughout
✅ **Framework Agnostic** - Works with any TypeScript project

## Examples

### Frontend Integration

```typescript
import type { NetworkOverviewResponse } from '@bmap/types';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<NetworkOverviewResponse>();
  
  useEffect(() => {
    fetch('/analytics/network/overview')
      .then(res => res.json())
      .then(setStats);
  }, []);
  
  return (
    <div>
      <h1>Network Stats</h1>
      <p>Total Users: {stats?.totalUsers}</p>
      <p>Active Users (24h): {stats?.activeUsers24h}</p>
    </div>
  );
};
```

### Node.js Client

```typescript
import type {
  QueryRequest,
  BMAPTransaction,
  TrendingUsersResponse
} from '@bmap/types';

class BMAPAnalytics {
  constructor(private baseUrl: string) {}
  
  async getTrendingUsers(
    timeframe: '24h' | '7d' | '30d' = '24h',
    limit: number = 20
  ): Promise<TrendingUsersResponse> {
    const response = await fetch(
      `${this.baseUrl}/analytics/trending/users?timeframe=${timeframe}&limit=${limit}`
    );
    return response.json();
  }
  
  async searchTransactions(query: QueryRequest): Promise<BMAPTransaction[]> {
    const response = await fetch(`${this.baseUrl}/q`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    });
    const result = await response.json();
    return result.results;
  }
}
```

### Mobile App (React Native)

```typescript
import type { IdentityData, PostSearchResponse } from '@bmap/types';

const useIdentitySearch = (query: string) => {
  const [results, setResults] = useState<IdentityData[]>([]);
  
  useEffect(() => {
    if (query.length < 2) return;
    
    fetch(`/social/identity/search?q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then((data: { identities: IdentityData[] }) => {
        setResults(data.identities);
      });
  }, [query]);
  
  return results;
};
```

## Version Compatibility

| @bmap/types | BMAP API | Features |
|-------------|----------|----------|
| 1.0.x       | 1.0.x    | Core types, Analytics Phases 1-5 |
| 1.1.x       | 1.1.x    | Enhanced social features |
| 2.0.x       | 2.0.x    | Breaking changes, new protocols |

## Contributing

This package is automatically generated from the BMAP API source code. 

To update types:
1. Make changes to the API schemas
2. Run `bun run build:types` in the main repository
3. The types package will be automatically updated

## License

MIT License - see LICENSE file for details.

## Links

- [BMAP API Documentation](https://github.com/BitcoinSchema/bmap-api)
- [Bitcoin Schema](https://github.com/BitcoinSchema)
- [BSV Blockchain](https://bitcoinsv.com) 