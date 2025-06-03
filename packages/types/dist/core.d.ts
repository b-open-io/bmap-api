/**
 * Base transaction input structure
 */
export interface TransactionInput {
    i: number;
    tape: null;
    e: {
        a: string;
        v: number;
        i: number;
        h: string;
    };
    seq: number;
}
/**
 * Base transaction output structure
 */
export interface TransactionOutput {
    i: number;
    tape: null;
    e: {
        v: number;
        i: number;
        a?: string;
    };
}
/**
 * Block information
 */
export interface BlockInfo {
    i: number;
    t: number;
}
/**
 * Transaction reference
 */
export interface TransactionRef {
    h: string;
}
/**
 * AIP (Address Identity Protocol) signature data
 */
export interface AIPSignature {
    algorithm: string;
    address: string;
    data: string[];
    signature: string;
    algorithm_signing_component?: string;
}
/**
 * MAP (Magic Attribute Protocol) data
 */
export interface MAPData {
    CMD?: string;
    app?: string;
    type?: string;
    [key: string]: string | undefined;
}
/**
 * B protocol data (Bitcoin Files) - normalized structure
 */
export interface BData {
    encoding: string;
    content: string;
    'content-type': string;
    filename: string;
    media_type?: string;
    Data?: Record<string, unknown>;
}
/**
 * Base transaction structure (shared by all transaction types)
 */
export interface BaseTransaction {
    _id: string;
    tx: TransactionRef;
    blk: BlockInfo;
    timestamp: number;
    AIP: AIPSignature[];
    MAP: MAPData[];
    B: BData[];
    in: TransactionInput[];
    out: TransactionOutput[];
    lock?: number;
    SIGMA?: null;
}
/**
 * Post transaction (MAP.type = "post")
 */
export interface PostTransaction extends BaseTransaction {
    MAP: (MAPData & {
        type: 'post';
        app?: string;
    })[];
}
/**
 * Message transaction (MAP.type = "message")
 */
export interface MessageTransaction extends BaseTransaction {
    MAP: (MAPData & {
        type: 'message';
        app?: string;
        bapID?: string;
        encrypted?: string;
        context?: string;
        channel?: string;
        messageID?: string;
    })[];
}
/**
 * Like transaction (MAP.type = "like")
 */
export interface LikeTransaction extends BaseTransaction {
    MAP: (MAPData & {
        type: 'like';
        tx?: string;
        messageID?: string;
        emoji?: string;
    })[];
}
/**
 * Friend transaction (MAP.type = "friend")
 */
export interface FriendTransaction extends BaseTransaction {
    MAP: (MAPData & {
        type: 'friend';
        bapID?: string;
    })[];
}
/**
 * Follow transaction (MAP.type = "follow")
 */
export interface FollowTransaction extends BaseTransaction {
    MAP: (MAPData & {
        type: 'follow';
        idKey?: string;
    })[];
}
/**
 * Unfollow transaction (MAP.type = "unfollow")
 */
export interface UnfollowTransaction extends BaseTransaction {
    MAP: (MAPData & {
        type: 'unfollow';
        idKey?: string;
    })[];
}
/**
 * Address with transaction history
 */
export interface BapAddress {
    address: string;
    txId: string;
    block?: number;
}
/**
 * Identity data (JSON-LD schema.org Person)
 */
export interface IdentityData {
    '@context'?: string;
    '@type': string;
    alternateName?: string;
    description?: string;
    image?: string;
    url?: string;
    email?: string;
    paymail?: string;
    banner?: string;
    logo?: string;
    bitcoinAddress?: string;
    familyName?: string;
    givenName?: string;
    firstSeen: number;
    homeLocation?: {
        '@type'?: string;
        name?: string;
        latitude?: string;
        longitude?: string;
    };
}
/**
 * BAP Identity (complete identity record)
 */
export interface BapIdentity {
    idKey: string;
    rootAddress: string;
    currentAddress: string;
    addresses: BapAddress[];
    identity: IdentityData;
    identityTxId: string;
    block: number;
    timestamp: number;
    valid: boolean;
    paymail?: string;
    displayName?: string;
    icon?: string;
    firstSeen: number;
}
/**
 * Pagination metadata
 */
export interface PaginationMeta {
    page: number;
    limit: number;
    count: number;
}
/**
 * Post metadata (likes, replies, reactions)
 */
export interface PostMeta {
    tx: string;
    likes: number;
    reactions: Array<{
        emoji: string;
        count: number;
    }>;
    replies: number;
}
/**
 * Posts response (for feeds, user posts, etc.)
 */
export interface PostsResponse extends PaginationMeta {
    bapID?: string;
    results: PostTransaction[];
    signers: BapIdentity[];
    meta: PostMeta[];
}
/**
 * Single post response
 */
export interface PostResponse {
    post: PostTransaction;
    signers: BapIdentity[];
    meta: PostMeta;
}
/**
 * Messages response
 */
export interface MessagesResponse extends PaginationMeta {
    bapID?: string;
    results: MessageTransaction[];
    signers: BapIdentity[];
}
/**
 * Channel info
 */
export interface ChannelInfo {
    channel: string;
    creator?: string | null;
    last_message?: string | null;
    last_message_time?: number;
    messages?: number;
    public_read?: boolean;
    public_write?: boolean;
    bapId?: string;
    tx?: TransactionRef;
    timestamp?: number;
    blk?: BlockInfo;
}
/**
 * Like info with reactions
 */
export interface LikeInfo {
    tx: string;
    txid?: string;
    likes: LikeTransaction[];
    total: number;
    signers: BapIdentity[];
    reactions: Record<string, Array<{
        emoji: string;
        bapId: string;
    }>>;
}
/**
 * Likes response (for /post/:txid/like, /bap/:bapId/like)
 */
export interface LikesResponse extends PaginationMeta {
    bapID?: string;
    results: LikeTransaction[];
    signers: BapIdentity[];
}
/**
 * Friend/relationship data
 */
export interface Friend {
    bapId: string;
    name?: string;
    icon?: string;
    mePublicKey?: string;
    themPublicKey?: string;
    txids?: string[];
}
export interface FriendData {
    friends: Friend[];
    incoming: Friend[];
    outgoing: Friend[];
}
export interface PostsParams {
    bapId?: string;
    address?: string;
    feed?: boolean;
    page: number;
    limit: number;
}
export interface RepliesParams {
    txid: string;
    page: number;
    limit: number;
}
export interface SearchParams {
    q: string;
    limit: number;
    offset: number;
}
export interface DirectMessageParams {
    bapId: string;
    targetBapId?: string;
    page: number;
    limit: number;
}
export interface ChannelMessageParams {
    channelId: string;
    page: number;
    limit: number;
}
export interface LikesQueryRequest {
    txids?: string[];
    messageIds?: string[];
}
export declare enum Timeframe {
    Day = "24h",
    Week = "week",
    Month = "month",
    Year = "year",
    All = "all"
}
/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
    status: string;
    result: T;
    error?: string;
}
/**
 * Error response
 */
export interface ErrorResponse {
    code: string;
    message: string;
}
//# sourceMappingURL=core.d.ts.map