// Auto-generated from schemas/entities/post
// Do not edit manually - regenerate with 'bun run build:types'

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
