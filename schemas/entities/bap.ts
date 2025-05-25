// BAP (Bitcoin Attestation Protocol) related types and schemas

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

export type BapIdentity = BapIdentityObject | string;