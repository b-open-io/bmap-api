// Auto-generated from schemas/entities/friend
// Do not edit manually - regenerate with 'bun run build:types'

export interface RelationshipState {
  bapId: string;
  MAP: Record<string, unknown>;
}

export interface FriendRequest {
  requester: RelationshipState;
  recipient: RelationshipState;
}

export interface FriendRequest {
  requester: RelationshipState;
  recipient: RelationshipState;
}

export interface Friend {
  bapId: string;
  name?: string;
  icon?: string;
}

export interface FriendshipResponse {
  user: string;
  isFriend: boolean;
  isFollower: boolean;
  isFollowing: boolean;
  friends?: Friend[];
  followers?: Friend[];
  following?: Friend[];
}

export interface FriendshipResponse {
  user: string;
  isFriend: boolean;
  isFollower: boolean;
  isFollowing: boolean;
  friends?: Friend[];
  followers?: Friend[];
  following?: Friend[];
}
