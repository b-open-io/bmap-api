import { Elysia } from 'elysia';
import {
  checkAlerts,
  exportAnalyticsData,
  getAdminStats,
  getContentAnalytics,
  getNetworkActivity,
  getNetworkGrowth,
  getNetworkHealth,
  getNetworkOverview,
  getStreamUpdate,
  getTrendingChannels,
  getTrendingContent,
  getTrendingUsers,
  getUserMetrics,
} from './queries.js';
import type { AlertConfig, DashboardConfig, StreamMessage } from './schemas.js';
import {
  AdminStatsParams,
  AdminStatsResponse,
  ContentAnalyticsParams,
  ContentAnalyticsResponse,
  ExportParams,
  NetworkActivityParams,
  NetworkActivityResponse,
  NetworkGrowthParams,
  NetworkGrowthResponse,
  NetworkHealthResponse,
  NetworkOverviewParams,
  NetworkOverviewResponse,
  StreamSubscriptionParams,
  TrendingChannelsParams,
  TrendingChannelsResponse,
  TrendingContentParams,
  TrendingContentResponse,
  TrendingUsersParams,
  TrendingUsersResponse,
  UserMetricsParams,
  UserMetricsResponse,
} from './schemas.js';

export const analyticsRoutes = new Elysia({ prefix: '/analytics' })
  .get(
    '/network/overview',
    async ({ set }) => {
      try {
        Object.assign(set.headers, {
          'Cache-Control': 'public, max-age=60',
        });

        return await getNetworkOverview();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to get network overview: ${message}`);
      }
    },
    {
      params: NetworkOverviewParams,
      response: {
        200: NetworkOverviewResponse,
      },
      detail: {
        tags: ['analytics'],
        description: 'Get global network statistics and overview metrics',
        summary: 'Network overview',
        responses: {
          200: {
            description: 'Global network statistics',
          },
        },
      },
    }
  )

  .get(
    '/trending/channels',
    async ({ query, set }) => {
      try {
        Object.assign(set.headers, {
          'Cache-Control': 'public, max-age=300', // 5 minutes
        });

        const timeframe = (query.timeframe as string) || '24h';
        const limit = Math.min(Number(query.limit) || 20, 100);

        return await getTrendingChannels(timeframe, limit);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to get trending channels: ${message}`);
      }
    },
    {
      query: TrendingChannelsParams,
      response: {
        200: TrendingChannelsResponse,
      },
      detail: {
        tags: ['analytics'],
        description: 'Get most active channels with growth and engagement metrics',
        summary: 'Trending channels',
        parameters: [
          {
            name: 'timeframe',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['24h', '7d', '30d'],
              default: '24h',
            },
            description: 'Time range for trending analysis',
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              default: 20,
            },
            description: 'Maximum number of channels to return',
          },
        ],
        responses: {
          200: {
            description: 'List of trending channels with metrics',
          },
        },
      },
    }
  )

  .get(
    '/network/activity',
    async ({ query, set }) => {
      try {
        Object.assign(set.headers, {
          'Cache-Control': 'public, max-age=30', // 30 seconds
        });

        const limit = Math.min(Number(query.limit) || 50, 100);
        const type = (query.type as string) || 'all';

        return await getNetworkActivity(limit, type);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to get network activity: ${message}`);
      }
    },
    {
      query: NetworkActivityParams,
      response: {
        200: NetworkActivityResponse,
      },
      detail: {
        tags: ['analytics'],
        description: 'Get real-time global activity feed of recent network actions',
        summary: 'Network activity feed',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              default: 50,
            },
            description: 'Maximum number of activities to return',
          },
          {
            name: 'type',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['message', 'post', 'friend', 'all'],
              default: 'all',
            },
            description: 'Filter by activity type',
          },
        ],
        responses: {
          200: {
            description: 'List of recent network activities',
          },
        },
      },
    }
  )

  .get(
    '/network/growth',
    async ({ query, set }) => {
      try {
        Object.assign(set.headers, {
          'Cache-Control': 'public, max-age=3600', // 1 hour
        });

        const timeframe = (query.timeframe as string) || '7d';
        const metric = (query.metric as string) || 'users';

        return await getNetworkGrowth(timeframe, metric);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to get network growth: ${message}`);
      }
    },
    {
      query: NetworkGrowthParams,
      response: {
        200: NetworkGrowthResponse,
      },
      detail: {
        tags: ['analytics'],
        description: 'Get time-series growth data for various network metrics',
        summary: 'Network growth metrics',
        parameters: [
          {
            name: 'timeframe',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['7d', '30d', '90d', '1y'],
              default: '7d',
            },
            description: 'Time range for growth analysis',
          },
          {
            name: 'metric',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['users', 'messages', 'channels', 'transactions'],
              default: 'users',
            },
            description: 'Metric to analyze growth for',
          },
        ],
        responses: {
          200: {
            description: 'Time-series growth data',
          },
        },
      },
    }
  )

  .get(
    '/admin/stats',
    async ({ set }) => {
      try {
        Object.assign(set.headers, {
          'Cache-Control': 'public, max-age=300', // 5 minutes
        });

        return await getAdminStats();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to get admin stats: ${message}`);
      }
    },
    {
      params: AdminStatsParams,
      response: {
        200: AdminStatsResponse,
      },
      detail: {
        tags: ['analytics'],
        description: 'Get comprehensive administrative dashboard statistics',
        summary: 'Admin statistics',
        responses: {
          200: {
            description: 'Administrative dashboard data',
          },
        },
      },
    }
  )

  .get(
    '/trending/users',
    async ({ query, set }) => {
      try {
        Object.assign(set.headers, {
          'Cache-Control': 'public, max-age=300', // 5 minutes
        });

        const timeframe = (query.timeframe as string) || '24h';
        const limit = Math.min(Number(query.limit) || 20, 100);
        const metric = (query.metric as string) || 'messages';

        return await getTrendingUsers(timeframe, limit, metric);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to get trending users: ${message}`);
      }
    },
    {
      query: TrendingUsersParams,
      response: {
        200: TrendingUsersResponse,
      },
      detail: {
        tags: ['analytics'],
        description: 'Get most active and followed users with engagement metrics',
        summary: 'Trending users',
        parameters: [
          {
            name: 'timeframe',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['24h', '7d', '30d'],
              default: '24h',
            },
            description: 'Time range for trending analysis',
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              default: 20,
            },
            description: 'Maximum number of users to return',
          },
          {
            name: 'metric',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['messages', 'followers', 'engagement'],
              default: 'messages',
            },
            description: 'Metric to rank users by',
          },
        ],
        responses: {
          200: {
            description: 'List of trending users with metrics',
          },
        },
      },
    }
  )

  .get(
    '/user/:userId/metrics',
    async ({ params, query, set }) => {
      try {
        Object.assign(set.headers, {
          'Cache-Control': 'public, max-age=600', // 10 minutes
        });

        const { userId } = params;
        const timeframe = (query.timeframe as string) || '7d';

        return await getUserMetrics(userId, timeframe);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to get user metrics: ${message}`);
      }
    },
    {
      params: UserMetricsParams,
      response: {
        200: UserMetricsResponse,
      },
      detail: {
        tags: ['analytics'],
        description: 'Get comprehensive analytics for a specific user',
        summary: 'User metrics',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'User ID (Bitcoin address) to get metrics for',
          },
          {
            name: 'timeframe',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['7d', '30d', '90d'],
              default: '7d',
            },
            description: 'Time range for metrics analysis',
          },
        ],
        responses: {
          200: {
            description: 'Detailed user analytics and metrics',
          },
        },
      },
    }
  )

  .get(
    '/content/analytics',
    async ({ query, set }) => {
      try {
        Object.assign(set.headers, {
          'Cache-Control': 'public, max-age=900', // 15 minutes
        });

        const type = (query.type as string) || 'posts';
        const timeframe = (query.timeframe as string) || '7d';
        const limit = Math.min(Number(query.limit) || 20, 100);

        return await getContentAnalytics(type, timeframe, limit);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to get content analytics: ${message}`);
      }
    },
    {
      query: ContentAnalyticsParams,
      response: {
        200: ContentAnalyticsResponse,
      },
      detail: {
        tags: ['analytics'],
        description:
          'Get comprehensive content analytics including overview, top content, and trends',
        summary: 'Content analytics overview',
        parameters: [
          {
            name: 'type',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['posts', 'messages', 'media'],
              default: 'posts',
            },
            description: 'Type of content to analyze',
          },
          {
            name: 'timeframe',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['24h', '7d', '30d'],
              default: '7d',
            },
            description: 'Time period for analysis',
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              default: 20,
            },
            description: 'Maximum number of top content items to return',
          },
        ],
      },
    }
  )

  .get(
    '/content/trending',
    async ({ query, set }) => {
      try {
        Object.assign(set.headers, {
          'Cache-Control': 'public, max-age=600', // 10 minutes
        });

        const type = (query.type as string) || 'posts';
        const timeframe = (query.timeframe as string) || '24h';
        const limit = Math.min(Number(query.limit) || 20, 50);
        const metric = (query.metric as string) || 'engagement';

        return await getTrendingContent(type, timeframe, limit, metric);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to get trending content: ${message}`);
      }
    },
    {
      query: TrendingContentParams,
      response: {
        200: TrendingContentResponse,
      },
      detail: {
        tags: ['analytics'],
        description:
          'Get trending content ranked by various metrics like views, likes, or engagement',
        summary: 'Trending content',
        parameters: [
          {
            name: 'type',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['posts', 'messages', 'media'],
              default: 'posts',
            },
            description: 'Type of content to analyze',
          },
          {
            name: 'timeframe',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['24h', '7d', '30d'],
              default: '24h',
            },
            description: 'Time period for trending analysis',
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: {
              type: 'number',
              minimum: 1,
              maximum: 50,
              default: 20,
            },
            description: 'Maximum number of trending items to return',
          },
          {
            name: 'metric',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['views', 'likes', 'engagement'],
              default: 'engagement',
            },
            description: 'Metric to rank content by',
          },
        ],
      },
    }
  )

  // Phase 5: Advanced Features
  .get(
    '/export',
    async ({ query, set }) => {
      try {
        const endpoint = query.endpoint as string;
        const format = (query.format as 'csv' | 'json' | 'xlsx') || 'json';
        let filters = {};
        try {
          filters = JSON.parse((query.filters as string) || '{}');
        } catch {
          filters = {};
        }

        const data = await exportAnalyticsData(endpoint, format, filters);

        // Set appropriate content type and headers
        const contentTypes = {
          json: 'application/json',
          csv: 'text/csv',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };

        Object.assign(set.headers, {
          'Content-Type': contentTypes[format],
          'Content-Disposition': `attachment; filename="analytics-${endpoint.replace('/', '-')}-${Date.now()}.${format}"`,
        });

        return data;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to export data: ${message}`);
      }
    },
    {
      query: ExportParams,
      detail: {
        tags: ['analytics'],
        description: 'Export analytics data in various formats (CSV, JSON, XLSX)',
        summary: 'Export analytics data',
        parameters: [
          {
            name: 'endpoint',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Analytics endpoint to export data from',
          },
          {
            name: 'format',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['csv', 'json', 'xlsx'],
              default: 'json',
            },
            description: 'Export format',
          },
          {
            name: 'filters',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'JSON string of filters to apply',
          },
        ],
      },
    }
  )

  .post(
    '/alerts/check',
    async ({ body }) => {
      try {
        const alertConfigs = body as AlertConfig[];
        return await checkAlerts(alertConfigs);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to check alerts: ${message}`);
      }
    },
    {
      detail: {
        tags: ['analytics'],
        description: 'Check alert thresholds and return triggered alerts',
        summary: 'Check alerts',
      },
    }
  )

  .get(
    '/stream/:stream',
    async ({ params, query, set }) => {
      const { stream } = params;
      let filters = {};
      try {
        filters = query.filters ? JSON.parse(query.filters as string) : {};
      } catch {
        filters = {};
      }

      Object.assign(set.headers, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      });

      try {
        async function* eventGenerator() {
          const isActive = true;

          // Send initial connection acknowledgment
          yield `data: ${JSON.stringify({
            type: 'subscription-ack',
            stream,
            timestamp: new Date().toISOString(),
            data: { message: `Subscribed to ${stream}` },
          } as StreamMessage)}\n\n`;

          // Stream updates every 30 seconds
          while (isActive) {
            try {
              const data = await getStreamUpdate(stream, filters);

              yield `data: ${JSON.stringify({
                type: 'data-update',
                stream,
                timestamp: new Date().toISOString(),
                data,
              } as StreamMessage)}\n\n`;
            } catch (error) {
              yield `data: ${JSON.stringify({
                type: 'error',
                stream,
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : String(error),
              } as StreamMessage)}\n\n`;
            }

            // Wait 30 seconds between updates
            await new Promise((resolve) => setTimeout(resolve, 30000));

            // Send heartbeat
            yield `data: ${JSON.stringify({
              type: 'heartbeat',
              timestamp: new Date().toISOString(),
            } as StreamMessage)}\n\n`;
          }
        }

        return eventGenerator();
      } catch (error) {
        throw new Error(`Failed to initialize stream: ${error}`);
      }
    },
    {
      params: StreamSubscriptionParams,
      detail: {
        tags: ['analytics'],
        description: 'Real-time streaming of analytics data via Server-Sent Events',
        summary: 'Stream analytics data',
        parameters: [
          {
            name: 'stream',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              enum: ['network-activity', 'trending-channels', 'user-metrics', 'content-analytics'],
            },
            description: 'Type of analytics stream to subscribe to',
          },
          {
            name: 'filters',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'JSON string of filters for the stream',
          },
        ],
      },
    }
  );

// Health routes (separate from analytics)
export const healthRoutes = new Elysia({ prefix: '/health' }).get(
  '/network/status',
  async ({ set }) => {
    try {
      Object.assign(set.headers, {
        'Cache-Control': 'public, max-age=30', // 30 seconds
      });

      return await getNetworkHealth();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get network status: ${message}`);
    }
  },
  {
    response: {
      200: NetworkHealthResponse,
    },
    detail: {
      tags: ['health'],
      description: 'Get real-time network health and system status indicators',
      summary: 'Network health status',
      responses: {
        200: {
          description: 'Current network health status',
        },
      },
    },
  }
);
