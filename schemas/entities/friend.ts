// Friend/relationship entity types

export interface RelationshipState {
  bapId: string;
  MAP: Record<string, unknown>;
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
