// Auto-generated from schemas/entities/bap
// Do not edit manually - regenerate with 'bun run build:types'

export interface BapAddress {
  address: string;
  lastUpdate: number;
  block: number;
  timestamp: number;
  bapId: string;
}

export interface BapIdentityObject {
  idKey: string;
  addresses: BapAddress[];
  rootAddress: string;
  currentAddress: string;
  lastUpdate: number;
  block: number;
  timestamp: number;
  valid: boolean;
}

export interface BapIdentityObject {
  idKey: string;
  addresses: BapAddress[];
  rootAddress: string;
  currentAddress: string;
  lastUpdate: number;
  block: number;
  timestamp: number;
  valid: boolean;
}

export type BapIdentity = BapIdentityObject | string;
