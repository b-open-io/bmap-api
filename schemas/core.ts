import { t } from 'elysia';

// ============================================
// CORE REUSABLE COMPONENTS
// ============================================

// Basic transaction structure (used everywhere)
export const TxSchema = t.Object({
  h: t.String({ description: 'Transaction hash' }),
});

export const BlockSchema = t.Object({
  i: t.Number({ description: 'Block height' }),
  t: t.Number({ description: 'Block timestamp' }),
});

// Universal pagination (standardized on strings for query params)
export const PaginationQuery = t.Object({
  page: t.Optional(t.String({ description: 'Page number' })),
  limit: t.Optional(t.String({ description: 'Items per page' })),
});

// Universal search
export const SearchQuery = t.Object({
  q: t.String({ description: 'Search query' }),
  limit: t.Optional(t.String({ description: 'Number of results' })),
  offset: t.Optional(t.String({ description: 'Offset for pagination' })),
});

// ============================================
// PATH PARAMETER SCHEMAS (STANDARDIZED)
// ============================================

export const BapIdParams = t.Object({
  bapId: t.String({
    description: 'BAP identity key',
    minLength: 20,
    maxLength: 30,
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
export const MAPSchema = t.Object({
  app: t.Optional(t.String()),
  type: t.Optional(t.String()),
  paymail: t.Optional(t.String()),
  context: t.Optional(t.String()),
  channel: t.Optional(t.String()),
  bapID: t.Optional(t.String()),
  encrypted: t.Optional(t.String()),
  messageID: t.Optional(t.String()),
});

// AIP Protocol
export const AIPSchema = t.Object({
  algorithm: t.Optional(t.String()),
  address: t.Optional(t.String()),
  signature: t.Optional(t.String()),
});

// B Protocol (content)
export const BSchema = t.Object({
  encoding: t.Optional(t.String()),
  content: t.Optional(t.String()),
  'content-type': t.Optional(t.String()),
  filename: t.Optional(t.String()),
});

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
export const BmapTxSchema = t.Object({
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
});

// ============================================
// IDENTITY SCHEMAS (BAP)
// ============================================

export const AddressEntrySchema = t.Object({
  address: t.String(),
  txId: t.String(),
  block: t.Optional(t.Number()),
});

export const BapIdentitySchema = t.Object({
  idKey: t.String(),
  rootAddress: t.String(),
  currentAddress: t.String(),
  addresses: t.Array(AddressEntrySchema),
  identity: t.Union([
    t.String(), // JSON string
    t.Object({
      '@context': t.Optional(t.String()),
      '@type': t.Optional(t.String()),
      alternateName: t.Optional(t.String()),
      description: t.Optional(t.String()),
      image: t.Optional(t.String()),
      url: t.Optional(t.String()),
      email: t.Optional(t.String()),
      paymail: t.Optional(t.String()),
      banner: t.Optional(t.String()),
      logo: t.Optional(t.String()),
      bitcoinAddress: t.Optional(t.String()),
      familyName: t.Optional(t.String()),
      givenName: t.Optional(t.String()),
      homeLocation: t.Optional(
        t.Object({
          '@type': t.Optional(t.String()),
          name: t.Optional(t.String()),
          latitude: t.Optional(t.String()),
          longitude: t.Optional(t.String()),
        })
      ),
    }),
    t.Unknown(), // Fallback for complex structures
  ]),
  identityTxId: t.String(),
  block: t.Number(),
  timestamp: t.Number(),
  valid: t.Boolean(),
  paymail: t.Optional(t.String()),
  displayName: t.Optional(t.String()),
  icon: t.Optional(t.String()),
});

// ============================================
// MESSAGE SCHEMAS (CONSOLIDATED)
// ============================================

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

export const FriendResponseSchema = t.Object({
  friends: t.Array(FriendSchema),
  incoming: t.Array(FriendSchema),
  outgoing: t.Array(FriendSchema),
});

// Channel information
export const ChannelInfoSchema = t.Object({
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
  txids: t.Optional(t.Array(t.String())),
  messageIds: t.Optional(t.Array(t.String())),
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
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
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
