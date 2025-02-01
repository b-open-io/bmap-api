export interface Identity {
  idKey: string;
  rootAddress: string;
  currentAddress: string;
  addresses: {
    address: string;
    txId: string;
    block?: number;
  }[];
  identity: string | Record<string, unknown>;
  identityTxId: string;
  block: number;
  timestamp: number;
  valid: boolean;
}
