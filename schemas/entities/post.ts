// Post-related entity types

export interface Post {
  _id: string;
  MAP: Array<{
    app?: string;
    type?: string;
    [key: string]: any;
  }>;
  AIP?: {
    algorithm?: string;
    address?: string;
    signature?: string;
    [key: string]: any;
  };
  B?: {
    content?: string;
    [key: string]: any;
  };
  BAP?: {
    type?: string;
    address?: string;
    [key: string]: any;
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