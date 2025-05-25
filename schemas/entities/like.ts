// Like/reaction entity types

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

export interface LikeInfo {
  tx: string;
  reactions: Reactions;
}
