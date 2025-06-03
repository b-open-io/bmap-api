// Auto-generated from schemas/entities/message
// Do not edit manually - regenerate with 'bun run build:types'

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

export interface ChannelMessage extends Message {
  channel: string;
  mb?: string;
}

export interface DMResponse {
  messages: Message[];
  lastMessage?: Message;
}
