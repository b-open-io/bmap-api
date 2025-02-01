import { t } from 'elysia';
import type { OpenAPIV3 } from 'openapi-types';
import type { BapIdentity } from '../../bap';

export interface SigmaIdentityAPIResponse {
  status: string;
  result: SigmaIdentityResult;
  error: string | null;
}

export interface SigmaIdentityResult {
  idKey: string;
  rootAddress: string;
  currentAddress: string;
  addresses: {
    address: string;
    txId: string;
    block: number | undefined;
  }[];
  identity: string;
  identityTxId: string;
  block: number;
  timestamp: number;
  valid: boolean;
}

export const IdentityResponseSchema = t.Array(
  t.Object({
    idKey: t.String(),
    rootAddress: t.String(),
    currentAddress: t.String(),
    addresses: t.Array(
      t.Object({
        address: t.String(),
        txId: t.String(),
        block: t.Optional(t.Number()),
      })
    ),
    identity: t.String(),
    identityTxId: t.String(),
    block: t.Number(),
    timestamp: t.Number(),
    valid: t.Boolean(),
  })
);

export const identityEndpointDetail: OpenAPIV3.OperationObject = {
  tags: ['social'],
  description: 'Get list of all identities',
  summary: 'List identities',
  responses: {
    '200': {
      description: 'List of identities',
      content: {
        'application/json': {
          schema: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                idKey: {
                  type: 'string' as const,
                  description: 'Identity key',
                },
                rootAddress: {
                  type: 'string' as const,
                  description: 'Root address',
                },
                currentAddress: {
                  type: 'string' as const,
                  description: 'Current address',
                },
                addresses: {
                  type: 'array' as const,
                  items: {
                    type: 'object' as const,
                    properties: {
                      address: {
                        type: 'string' as const,
                        description: 'Bitcoin address',
                      },
                      txId: {
                        type: 'string' as const,
                        description: 'Transaction ID',
                      },
                      block: {
                        type: 'number' as const,
                        description: 'Block number',
                        nullable: true,
                      },
                    },
                  },
                },
                identity: {
                  type: 'string' as const,
                  description: 'Identity data',
                },
                identityTxId: {
                  type: 'string' as const,
                  description: 'Identity transaction ID',
                },
                block: {
                  type: 'number' as const,
                  description: 'Block number',
                },
                timestamp: {
                  type: 'number' as const,
                  description: 'Timestamp',
                },
                valid: {
                  type: 'boolean' as const,
                  description: 'Validity flag',
                },
              },
            },
          },
        },
      },
    },
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: {
            type: 'array' as const,
            items: {},
          },
        },
      },
    },
  },
};
