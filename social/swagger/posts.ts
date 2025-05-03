import { t } from "elysia";

export const PostQuery = t.Object({
    page: t.Optional(t.String()),
    limit: t.Optional(t.String()),
  });

export interface Post {
    tx: {
      h: string;
    };
    blk: {
      i: number;
      t: number;
    };
    MAP: {
      app: string;
      type: 'post';
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