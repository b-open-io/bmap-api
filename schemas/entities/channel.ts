// Channel-related entity types

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