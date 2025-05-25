// Consolidated schemas and types for social features
import { t } from 'elysia';

// ============================================
// BASE TYPES & INTERFACES
// ============================================

// Friend/Relationship types
export interface RelationshipState {
  bapId?: string;
  MAP?: Record<string, unknown>;
  fromMe?: boolean;
  fromThem?: boolean;
  unfriended?: boolean;
  txids?: Set<string>;
  txid?: string;
  height?: number;
  mePublicKey?: string;
  themPublicKey?: string;
}

export interface FriendRequest {
  bapID?: string; // Note: uppercase ID for compatibility
  bapId?: string;
  txid?: string;
  height?: number;
  requester?: RelationshipState;
  recipient?: RelationshipState;
}

export interface Friend {
  bapID?: string; // Note: uppercase ID for compatibility
  bapId?: string;
  name?: string;
  icon?: string;
  mePublicKey?: string;
  themPublicKey?: string;
  txids?: string[];
}

export interface FriendshipResponse {
  user?: string;
  isFriend?: boolean;
  isFollower?: boolean;
  isFollowing?: boolean;
  friends?: Friend[];
  followers?: Friend[];
  following?: Friend[];
  incoming?: Friend[];
  outgoing?: Friend[];
}

export interface FriendData {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
}

export type FriendResponse = FriendData;

// Message types
export interface BaseMessage {
  tx: {
    h: string;
  };
  blk: {
    i: number;
    t: number;
  };
  MAP: {
    app: string;
    type: string;
    paymail?: string;
    context?: string;
    channel?: string;
    bapID?: string;
  }[];
  B: {
    encoding: string;
    content?: string;
    'content-type'?: string;
  }[];
  AIP?: {
    algorithm: string;
    address: string;
  }[];
}

export interface Message {
  bapId: string;
  decrypted: boolean;
  encrypted?: string;
  tx: {
    h: string;
  };
  timestamp: number;
  blk: {
    i: number;
    t: number;
  };
  _id: string;
}

export interface ChannelMessage extends BaseMessage {
  channel: string;
  mb?: string;
}

export interface ChannelMessageResponse {
  channel: string;
  page: number;
  limit: number;
  count: number;
  results: BaseMessage[];
  signers: unknown[];
}

export interface DMResponse {
  messages: Message[];
  lastMessage?: Message;
  signers?: unknown[];
}

// Channel types
export interface ChannelInfo {
  channel: string;
  public_read?: boolean;
  public_write?: boolean;
  bapId?: string;
  tx?: {
    h: string;
  };
  timestamp?: number;
  blk?: {
    i: number;
    t: number;
  };
}

// Like/Reaction types
export interface Reaction {
  emoji: string;
  bapId: string;
}

export interface Reactions {
  [key: string]: Reaction[];
}

export interface LikeRequest {
  action: string;
  tx: string;
  bapId: string;
  emoji?: string;
}

export interface LikesQueryRequest {
  txids?: string[];
  messageIds?: string[];
}

export interface LikeInfo {
  tx?: string;
  txid?: string;
  likes?: unknown[];
  total?: number;
  signers?: unknown[];
  reactions?: Reactions;
}

// Identity types
export interface SigmaIdentityResult {
  _id: string;
  identity: {
    alternateName?: string;
    description?: string;
    image?: string;
    url?: string;
    email?: string;
    homeLocation?: {
      name?: string;
      latitude?: string;
      longitude?: string;
    };
    bapId?: string;
  };
  bapId: string;
  idKey: string;
  addresses: string[];
  rootAddress?: string;
  currentAddress?: string;
  identityTxId?: string;
  block: number;
  timestamp: number;
  valid?: boolean;
}

export interface SigmaIdentityAPIResponse {
  status: string;
  result: SigmaIdentityResult;
  error?: string;
}

// Post types
export interface Post {
  _id: string;
  MAP: Array<{
    app?: string;
    type?: string;
    [key: string]: unknown;
  }>;
  AIP?: {
    algorithm?: string;
    address?: string;
    signature?: string;
    [key: string]: unknown;
  };
  B?: {
    content?: string;
    [key: string]: unknown;
  };
  BAP?: {
    type?: string;
    address?: string;
    [key: string]: unknown;
  };
  tx: {
    h: string;
  };
  blk?: {
    i: number;
    t: number;
  };
  timestamp?: number;
}

// ============================================
// TYPEBOX SCHEMAS FOR API VALIDATION
// ============================================

// Common query schemas
export const PaginationQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
});

// Friend schemas
export const FriendResponseSchema = t.Object({
  friends: t.Array(
    t.Object({
      bapId: t.String(),
      name: t.Optional(t.String()),
      icon: t.Optional(t.String()),
    })
  ),
  incoming: t.Array(
    t.Object({
      bapId: t.String(),
      name: t.Optional(t.String()),
      icon: t.Optional(t.String()),
    })
  ),
  outgoing: t.Array(
    t.Object({
      bapId: t.String(),
      name: t.Optional(t.String()),
      icon: t.Optional(t.String()),
    })
  ),
});

// Message schemas
export const MessageQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
});

export const ChannelMessageSchema = t.Object({
  channel: t.String(),
  page: t.Number(),
  limit: t.Number(),
  count: t.Number(),
  results: t.Array(
    t.Object({
      tx: t.Object({ h: t.String() }),
      blk: t.Object({ i: t.Number(), t: t.Number() }),
      MAP: t.Array(
        t.Object({
          app: t.String(),
          type: t.String(),
          paymail: t.Optional(t.String()),
          context: t.Optional(t.String()),
          channel: t.Optional(t.String()),
          bapID: t.Optional(t.String()),
        })
      ),
      B: t.Array(
        t.Object({
          encoding: t.String(),
          content: t.Optional(t.String()),
          'content-type': t.Optional(t.String()),
        })
      ),
      AIP: t.Optional(
        t.Array(
          t.Object({
            algorithm: t.String(),
            address: t.String(),
          })
        )
      ),
    })
  ),
  signers: t.Array(t.Unknown()), // BapIdentity array
});

export const MessageListenParams = t.Object({
  bapId: t.String(),
  targetBapId: t.Optional(t.String()),
});

export const DMResponseSchema = t.Object({
  messages: t.Array(
    t.Object({
      bapId: t.String(),
      decrypted: t.Boolean(),
      encrypted: t.Optional(t.String()),
      tx: t.Object({ h: t.String() }),
      timestamp: t.Number(),
      blk: t.Object({ i: t.Number(), t: t.Number() }),
      _id: t.String(),
    })
  ),
  lastMessage: t.Optional(
    t.Object({
      bapId: t.String(),
      decrypted: t.Boolean(),
      encrypted: t.Optional(t.String()),
      tx: t.Object({ h: t.String() }),
      timestamp: t.Number(),
      blk: t.Object({ i: t.Number(), t: t.Number() }),
      _id: t.String(),
    })
  ),
});

// Channel schemas
export const ChannelParams = t.Object({
  channelId: t.String(),
});

export const ChannelResponseSchema = t.Array(
  t.Object({
    channel: t.String(),
    public_read: t.Optional(t.Boolean()),
    public_write: t.Optional(t.Boolean()),
    bapId: t.Optional(t.String()),
    tx: t.Optional(
      t.Object({
        h: t.String(),
      })
    ),
    timestamp: t.Optional(t.Number()),
    blk: t.Optional(
      t.Object({
        i: t.Number(),
        t: t.Number(),
      })
    ),
  })
);

// Like schemas
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

export const LikeResponseSchema = t.Array(
  t.Object({
    tx: t.String(),
    reactions: t.Record(
      t.String(),
      t.Array(
        t.Object({
          emoji: t.String(),
          bapId: t.String(),
        })
      )
    ),
  })
);

// Identity schemas
export const IdentityResponseSchema = t.Array(
  t.Object({
    _id: t.String(),
    identity: t.Object({
      alternateName: t.Optional(t.String()),
      description: t.Optional(t.String()),
      image: t.Optional(t.String()),
      url: t.Optional(t.String()),
      email: t.Optional(t.String()),
      homeLocation: t.Optional(
        t.Object({
          name: t.Optional(t.String()),
          latitude: t.Optional(t.String()),
          longitude: t.Optional(t.String()),
        })
      ),
      bapId: t.Optional(t.String()),
    }),
    bapId: t.String(),
    idKey: t.String(),
    addresses: t.Array(t.String()),
    block: t.Number(),
    timestamp: t.Number(),
  })
);

// Post schemas
export const PostQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  mimetype: t.Optional(t.String()),
  channel: t.Optional(t.String()),
});
