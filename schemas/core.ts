import { t } from 'elysia';

// ============================================
// CORE REUSABLE COMPONENTS
// ============================================

// Basic transaction structure (used everywhere)
export const TxSchema = t.Object(
  {
    h: t.String({ description: 'Transaction hash' }),
  },
  { additionalProperties: true }
);

export const BlockSchema = t.Object(
  {
    i: t.Number({ description: 'Block height' }),
    t: t.Number({ description: 'Block timestamp' }),
  },
  { additionalProperties: true }
);

// Universal pagination (standardized on strings for query params)
export const PaginationQuery = t.Object({
  page: t.Optional(t.String({ description: 'Page number', pattern: '^[1-9][0-9]{0,3}$' })),
  limit: t.Optional(
    t.String({ description: 'Items per page (1–100)', pattern: '^(?:[1-9][0-9]?|100)$' })
  ),
});

// Universal search
export const SearchQuery = t.Object({
  q: t.String({ description: 'Search query' }),
  limit: t.Optional(
    t.String({ description: 'Number of results (1–100)', pattern: '^(?:[1-9][0-9]?|100)$' })
  ),
  offset: t.Optional(t.String({ description: 'Offset for pagination' })),
});

// ============================================
// PATH PARAMETER SCHEMAS (STANDARDIZED)
// ============================================

export const BapIdParams = t.Object({
  bapId: t.String({
    description: 'BAP identity key',
    minLength: 1,
    maxLength: 128,
    pattern: '^[a-zA-Z0-9]+$',
  }),
});

export const TxIdParams = t.Object({
  txid: t.String({
    description: 'Transaction ID',
    minLength: 64,
    maxLength: 64,
    pattern: '^[a-fA-F0-9]{64}$',
  }),
});

export const AddressParams = t.Object({
  address: t.String({
    description: 'Bitcoin address',
    minLength: 25,
    maxLength: 35,
  }),
});

export const ChannelParams = t.Object({
  channelId: t.String({ description: 'Channel identifier' }),
});

export const TargetBapIdParams = t.Object({
  bapId: t.String({ description: 'Source BAP identity key' }),
  targetBapId: t.String({ description: 'Target BAP identity key' }),
});

// ============================================
// PROTOCOL SCHEMAS (BITCOIN/BSV SPECIFIC)
// ============================================

// MAP Protocol
export const MAPSchema = t.Object(
  {
    app: t.Optional(t.String()),
    type: t.Optional(t.String()),
    paymail: t.Optional(t.String()),
    context: t.Optional(t.String()),
    channel: t.Optional(t.String()),
    bapID: t.Optional(t.String()),
    encrypted: t.Optional(t.String()),
    messageID: t.Optional(t.String()),
  },
  { additionalProperties: true }
);

// AIP Protocol
export const AIPSchema = t.Object(
  {
    algorithm: t.Optional(t.String()),
    address: t.Optional(t.String()),
    signature: t.Optional(t.String()),
  },
  { additionalProperties: true }
);

// B Protocol (content)
export const BSchema = t.Object(
  {
    encoding: t.Optional(t.String()),
    content: t.Optional(t.String()),
    'content-type': t.Optional(t.String()),
    filename: t.Optional(t.String()),
  },
  { additionalProperties: true }
);

// ============================================
// TRANSACTION SCHEMAS (COMPOSABLE)
// ============================================

// Base transaction (minimal)
export const BaseTxSchema = t.Object({
  tx: TxSchema,
  blk: t.Optional(BlockSchema),
  timestamp: t.Optional(t.Number()),
});

// Full BMAP transaction
export const BmapTxSchema = t.Object(
  {
    tx: TxSchema,
    blk: t.Optional(BlockSchema),
    timestamp: t.Optional(t.Number()),
    MAP: t.Optional(t.Array(MAPSchema)),
    AIP: t.Optional(t.Array(AIPSchema)),
    B: t.Optional(t.Array(BSchema)),
    in: t.Optional(t.Array(t.Unknown())),
    out: t.Optional(t.Array(t.Unknown())),
    lock: t.Optional(t.Number()),
    _id: t.Optional(t.String()),
  },
  { additionalProperties: true }
);

// ============================================
// IDENTITY SCHEMAS (BAP)
// ============================================

export const AddressEntrySchema = t.Object(
  {
    address: t.String(),
    txId: t.Optional(t.String()),
    block: t.Optional(t.Number()),
  },
  { additionalProperties: true }
);

export const BapIdentitySchema = t.Object(
  {
    idKey: t.String(),
    rootAddress: t.String(),
    currentAddress: t.String(),
    addresses: t.Array(AddressEntrySchema),
    identity: t.Unknown(), // Profiles may contain arbitrary schema.org extensions.
    identityTxId: t.String(),
    block: t.Number(),
    timestamp: t.Number(),
    valid: t.Boolean(),
    paymail: t.Optional(t.String()),
    displayName: t.Optional(t.String()),
    icon: t.Optional(t.String()),
  },
  { additionalProperties: true }
);

// ============================================
// MESSAGE SCHEMAS (CONSOLIDATED)
// ============================================

// Message metadata schema
export const MessageMetaSchema = t.Object({
  tx: t.String(), // Transaction hash
  readBy: t.Array(t.String()), // Array of BAP IDs who read it
  reactions: t.Array(
    t.Object({
      emoji: t.String(),
      count: t.Number(),
    })
  ),
  delivered: t.Boolean(), // Delivery confirmation
  edited: t.Optional(t.Boolean()), // If message was edited
  editedAt: t.Optional(t.Number()), // Timestamp of last edit
});

// Message content structure
export const MessageContentSchema = t.Object({
  bapId: t.String(),
  decrypted: t.Boolean(),
  encrypted: t.Optional(t.String()),
  tx: TxSchema,
  timestamp: t.Number(),
  blk: BlockSchema,
  _id: t.String(),
});

// Messages response with metadata (NEW)
export const MessagesResponseSchema = t.Object({
  bapID: t.Optional(t.String()),
  page: t.Number(),
  limit: t.Number(),
  count: t.Number(),
  results: t.Array(BmapTxSchema),
  signers: t.Array(BapIdentitySchema),
  meta: t.Array(MessageMetaSchema),
});

// Direct message response (SINGLE SOURCE OF TRUTH)
export const DMResponseSchema = t.Object({
  messages: t.Array(MessageContentSchema),
  lastMessage: t.Optional(MessageContentSchema),
  signers: t.Array(BapIdentitySchema),
});

// Channel message (simplified client format)
export const ChannelMessageSchema = t.Object({
  results: t.Array(BmapTxSchema),
  signers: t.Array(BapIdentitySchema),
});

// Full channel response (internal format)
export const ChannelMessageResponseSchema = t.Object({
  channel: t.String(),
  page: t.Number(),
  limit: t.Number(),
  count: t.Number(),
  results: t.Array(BmapTxSchema),
  signers: t.Array(BapIdentitySchema),
});

export const MessageListenParams = t.Object({
  bapId: t.String(),
  targetBapId: t.Optional(t.String()),
});

// ============================================
// SOCIAL SCHEMAS
// ============================================

// Friend data structure
export const FriendSchema = t.Object({
  bapId: t.String(),
  name: t.Optional(t.String()),
  icon: t.Optional(t.String()),
  mePublicKey: t.Optional(t.String()),
  themPublicKey: t.Optional(t.String()),
  txids: t.Optional(t.Array(t.String())),
});

// Friend request structure (for incoming/outgoing)
export const FriendRequestSchema = t.Object({
  bapId: t.String(),
  txid: t.Optional(t.String()),
  height: t.Optional(t.Number()),
});

export const FriendResponseSchema = t.Object({
  friends: t.Array(FriendSchema),
  incoming: t.Array(FriendRequestSchema),
  outgoing: t.Array(FriendRequestSchema),
});

// Channel information
export const ChannelInfoSchema = t.Object({
  _id: t.Optional(t.String()),
  channel: t.String(),
  creator: t.Optional(t.Union([t.String(), t.Null()])),
  last_message: t.Optional(t.Union([t.String(), t.Null()])),
  last_message_time: t.Optional(t.Number()),
  messages: t.Optional(t.Number()),
  public_read: t.Optional(t.Boolean()),
  public_write: t.Optional(t.Boolean()),
  bapId: t.Optional(t.String()),
  tx: t.Optional(TxSchema),
  timestamp: t.Optional(t.Number()),
  blk: t.Optional(BlockSchema),
});

export const ChannelResponseSchema = t.Array(ChannelInfoSchema);

// ============================================
// LIKE/REACTION SCHEMAS
// ============================================

export const ReactionSchema = t.Object({
  emoji: t.String(),
  bapId: t.String(),
});

export const LikeRequestSchema = t.Object({
  action: t.String(),
  tx: t.String(),
  bapId: t.String(),
  emoji: t.Optional(t.String()),
});

export const LikesQueryRequestSchema = t.Object({
  txids: t.Optional(t.Array(t.String(), { maxItems: 20 })),
  messageIds: t.Optional(t.Array(t.String(), { maxItems: 20 })),
});

export const LikeInfoSchema = t.Object({
  tx: t.String(),
  reactions: t.Record(t.String(), t.Array(ReactionSchema)),
});

export const LikeResponseSchema = t.Array(LikeInfoSchema);

// ============================================
// POST SCHEMAS
// ============================================

export const PostQuery = t.Object({
  page: t.Optional(t.String({ pattern: '^[1-9][0-9]{0,3}$' })),
  limit: t.Optional(t.String({ pattern: '^(?:[1-9][0-9]?|100)$' })),
  mimetype: t.Optional(t.String()),
  channel: t.Optional(t.String()),
});

export const MetaSchema = t.Object({
  tx: t.String(),
  likes: t.Number(),
  reactions: t.Array(
    t.Object({
      emoji: t.String(),
      count: t.Number(),
    })
  ),
  replies: t.Number(),
});

export const PostResponseSchema = t.Object({
  post: BmapTxSchema,
  signers: t.Array(BapIdentitySchema),
  meta: MetaSchema,
});

export const PostsResponseSchema = t.Object({
  bapID: t.Optional(t.String()),
  page: t.Number(),
  limit: t.Number(),
  count: t.Number(),
  results: t.Array(BmapTxSchema),
  signers: t.Array(BapIdentitySchema),
  meta: t.Array(MetaSchema),
});

// Activity aggregation response
export const ActivityResponseSchema = t.Object({
  results: t.Array(
    t.Intersect([
      BmapTxSchema,
      t.Object({
        collection: t.String(),
      }),
    ])
  ),
  signers: t.Array(BapIdentitySchema),
  meta: t.Object({
    limit: t.Number(),
    blocks: t.Union([t.Number(), t.Null()]),
    collections: t.Array(t.String()),
    cached: t.Boolean(),
  }),
});

// Activity query params
export const ActivityQuery = t.Object({
  limit: t.Optional(t.String({ pattern: '^(?:[1-9][0-9]?|100)$' })),
  blocks: t.Optional(t.String()),
  types: t.Optional(t.String()), // comma-separated: friend,message,like,pin_channel
});

// ============================================
// VIDEO SCHEMAS
// ============================================

export const VideoMetaSchema = t.Object({
  views: t.Optional(t.Number()),
  likes: t.Optional(t.Number()),
  comments: t.Optional(t.Number()),
  lastPlayed: t.Optional(t.Number()),
  reactions: t.Optional(
    t.Array(
      t.Object({
        emoji: t.String(),
        count: t.Number(),
      })
    )
  ),
});

export const VideoStateSchema = t.Object({
  channel: t.String(),
  videoID: t.String(),
  action: t.String(),
  position: t.Number(),
  timestamp: t.Number(),
  txid: t.String(),
});

export const VideoResponseSchema = t.Object({
  video: BmapTxSchema,
  meta: t.Optional(VideoMetaSchema),
});

export const VideosResponseSchema = t.Object({
  page: t.Number(),
  limit: t.Number(),
  count: t.Number(),
  results: t.Array(BmapTxSchema),
  signers: t.Array(BapIdentitySchema),
  meta: t.Optional(t.Array(VideoMetaSchema)),
});

export const VideoStateResponseSchema = t.Object({
  channel: t.String(),
  states: t.Array(VideoStateSchema),
});

export const VideoHistoryResponseSchema = t.Array(BmapTxSchema);

// ============================================
// SEARCH & AUTOFILL
// ============================================

export const AutofillQuery = t.Object({
  q: t.String({ description: 'Search query for autofill' }),
});

export const AutofillResponse = t.Object({
  status: t.String(),
  result: t.Object({
    identities: t.Array(BapIdentitySchema),
    posts: t.Array(BmapTxSchema),
  }),
});

// ============================================
// COMMON RESPONSE PATTERNS
// ============================================

export const ErrorResponse = t.Object({
  code: t.String(),
  message: t.String(),
  details: t.Optional(t.Unknown()),
});

export const SuccessResponse = t.Object({
  status: t.String(),
  result: t.Unknown(),
});

// ============================================
// EXPORTS FOR ANALYTICS (if needed)
// ============================================

export const FeedParams = t.Object({
  bapId: t.Optional(t.String({ description: 'BAP identity key for feed' })),
});

// Re-export commonly used schemas with clear names
export { BapIdentitySchema as IdentityResponseSchema, BapIdentitySchema as SignerSchema };

export const PaginatedLikesSchema = t.Object({
  bapID: t.Optional(t.String()),
  page: t.Number(),
  limit: t.Number(),
  count: t.Number(),
  results: t.Array(BmapTxSchema),
  signers: t.Array(BapIdentitySchema),
});
export const BatchLikesSchema = t.Array(
  t.Object({
    txid: t.String(),
    likes: t.Array(t.Unknown()),
    total: t.Number(),
    signers: t.Array(BapIdentitySchema),
  })
);
