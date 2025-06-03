# BMAP API Route Audit Report

## Summary
- **Total Routes**: 35
- **Routes with Schemas**: 16
- **Routes with Documentation**: 18
- **Total Schemas**: 28
- **Total Tags**: 4
- **Issues Found**: 21

## Issues Found

- ⚠️ Schema referenced but not defined: MessagesResponseSchema
- ⚠️ Schema defined but not used: AddressParams
- ⚠️ Schema defined but not used: FriendResponseSchema
- ⚠️ Schema defined but not used: AutofillResponse
- ⚠️ Schema defined but not used: ChannelMessageResponseSchema
- ⚠️ Schema defined but not used: ChannelMessageSchema
- ⚠️ Schema defined but not used: MessageListenParams
- ⚠️ Schema defined but not used: DMResponseSchema
- ⚠️ Schema defined but not used: ChannelParams
- ⚠️ Schema defined but not used: LikesQueryRequestSchema
- ⚠️ Schema defined but not used: IdentityResponseSchema
- ⚠️ Schema defined but not used: FeedParams
- ⚠️ Schema defined but not used: MetaSchema
- ⚠️ Schema defined but not used: PostsResponseSchema
- ⚠️ Schema defined but not used: ErrorResponse
- ⚠️ Schema defined but not used: SuccessResponse
- ⚠️ Schema defined but not used: ExportParams
- ⚠️ Route not documented in README: GET /analytics/network/status
- ⚠️ Route not documented in README: GET /s/:collectionName?/:base64Query
- ⚠️ README documents non-existent route: GET /s/:collectionName/:base64Query
- ⚠️ README documents non-existent route: GET /health/network/status

## Route Inventory

| Method | Path | File | Schemas | Tags | Documented |
|--------|------|------|---------|------|------------|
| GET | /analytics/admin/stats | analytics/routes.ts | AdminStatsParams, AdminStatsResponse | analytics | ✅ |
| POST | /analytics/alerts/check | analytics/routes.ts | - | analytics | ✅ |
| GET | /analytics/content/analytics | analytics/routes.ts | ContentAnalyticsParams, ContentAnalyticsResponse | analytics | ✅ |
| GET | /analytics/content/trending | analytics/routes.ts | TrendingContentParams, TrendingContentResponse | analytics | ✅ |
| GET | /analytics/export | analytics/routes.ts | - | - | ❌ |
| GET | /analytics/network/activity | analytics/routes.ts | NetworkActivityParams, NetworkActivityResponse | analytics | ✅ |
| GET | /analytics/network/growth | analytics/routes.ts | NetworkGrowthParams, NetworkGrowthResponse | analytics | ✅ |
| GET | /analytics/network/overview | analytics/routes.ts | NetworkOverviewParams, NetworkOverviewResponse | analytics | ✅ |
| GET | /analytics/network/status | analytics/routes.ts | NetworkHealthResponse | health | ✅ |
| GET | /analytics/stream/:stream | analytics/routes.ts | StreamSubscriptionParams | analytics | ✅ |
| GET | /analytics/trending/channels | analytics/routes.ts | TrendingChannelsParams, TrendingChannelsResponse | analytics | ✅ |
| GET | /analytics/trending/users | analytics/routes.ts | TrendingUsersParams, TrendingUsersResponse | analytics | ✅ |
| GET | /analytics/user/:userId/metrics | analytics/routes.ts | UserMetricsParams, UserMetricsResponse | analytics | ✅ |
| GET | /chart-data/:name? | routes/chart.ts | - | - | ❌ |
| POST | /ingest | routes/transaction.ts | - | transactions | ✅ |
| GET | /q/:collectionName/:base64Query | routes/query.ts | - | - | ❌ |
| GET | /s/:collectionName?/:base64Query | routes/query.ts | - | - | ❌ |
| GET | /social/@/:bapId/messages | social/routes.ts | BapIdParams, MessagesResponseSchema | - | ✅ |
| GET | /social/@/:bapId/messages/:targetBapId | social/routes.ts | TargetBapIdParams, MessagesResponseSchema | - | ✅ |
| GET | /social/autofill | social/routes.ts | - | - | ❌ |
| GET | /social/bap/:bapId/like | social/routes.ts | - | - | ❌ |
| GET | /social/channels | social/routes.ts | ChannelResponseSchema | - | ✅ |
| GET | /social/channels/:channelId/messages | social/routes.ts | - | - | ❌ |
| GET | /social/feed/:bapId? | social/routes.ts | - | - | ❌ |
| GET | /social/friend/:bapId | social/routes.ts | - | - | ❌ |
| GET | /social/identities | social/routes.ts | - | - | ❌ |
| GET | /social/identity/search | social/routes.ts | - | - | ❌ |
| POST | /social/likes | social/routes.ts | LikeRequestSchema, LikeResponseSchema | - | ✅ |
| GET | /social/post/:txid | social/routes.ts | TxIdParams, PostResponseSchema | posts | ✅ |
| GET | /social/post/:txid/like | social/routes.ts | - | - | ❌ |
| GET | /social/post/:txid/reply | social/routes.ts | - | - | ❌ |
| GET | /social/post/address/:address | social/routes.ts | - | - | ❌ |
| GET | /social/post/bap/:bapId | social/routes.ts | - | - | ❌ |
| GET | /social/post/search | social/routes.ts | - | - | ❌ |
| GET | /tx/:tx/:format? | routes/transaction.ts | - | - | ❌ |

## Schema Usage

- **AdminStatsParams**: Used in 1 route(s)
- **AdminStatsResponse**: Used in 1 route(s)
- **BapIdParams**: Used in 1 route(s)
- **ChannelResponseSchema**: Used in 1 route(s)
- **ContentAnalyticsParams**: Used in 1 route(s)
- **ContentAnalyticsResponse**: Used in 1 route(s)
- **LikeRequestSchema**: Used in 1 route(s)
- **LikeResponseSchema**: Used in 1 route(s)
- **MessagesResponseSchema**: Used in 2 route(s)
- **NetworkActivityParams**: Used in 1 route(s)
- **NetworkActivityResponse**: Used in 1 route(s)
- **NetworkGrowthParams**: Used in 1 route(s)
- **NetworkGrowthResponse**: Used in 1 route(s)
- **NetworkHealthResponse**: Used in 1 route(s)
- **NetworkOverviewParams**: Used in 1 route(s)
- **NetworkOverviewResponse**: Used in 1 route(s)
- **PostResponseSchema**: Used in 1 route(s)
- **StreamSubscriptionParams**: Used in 1 route(s)
- **TargetBapIdParams**: Used in 1 route(s)
- **TrendingChannelsParams**: Used in 1 route(s)
- **TrendingChannelsResponse**: Used in 1 route(s)
- **TrendingContentParams**: Used in 1 route(s)
- **TrendingContentResponse**: Used in 1 route(s)
- **TrendingUsersParams**: Used in 1 route(s)
- **TrendingUsersResponse**: Used in 1 route(s)
- **TxIdParams**: Used in 1 route(s)
- **UserMetricsParams**: Used in 1 route(s)
- **UserMetricsResponse**: Used in 1 route(s)

## Tags Used

- **analytics**: 11 route(s)
- **health**: 1 route(s)
- **posts**: 1 route(s)
- **transactions**: 1 route(s)
