import type { BapIdentity } from '../../bap.js';
import type { CacheValue } from '../../cache.js';
import { readFromRedis, saveToRedis } from '../../cache.js';
import type { SigmaIdentityAPIResponse, SigmaIdentityResult } from '../schemas.js';

export function sigmaIdentityToBapIdentity(result: SigmaIdentityResult): BapIdentity {
  return {
    idKey: result.idKey,
    rootAddress: result.rootAddress || '',
    currentAddress: result.currentAddress || '',
    addresses: result.addresses.map((addr) => ({
      address: addr,
      txId: '',
      block: result.block,
    })),
    identity: result.identity,
    identityTxId: result.identityTxId || '',
    block: result.block,
    timestamp: result.timestamp,
    valid: result.valid || true,
  };
}

export async function fetchBapIdentityData(bapId: string): Promise<BapIdentity> {
  const cacheKey = `sigmaIdentity-${bapId}`;
  const cached = await readFromRedis<CacheValue>(cacheKey);
  if (cached?.type === 'signer') {
    return cached.value;
  }

  const url = 'https://api.sigmaidentity.com/api/v1/identity/get';
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idKey: bapId }),
  });

  if (resp.status === 404) {
    return null;
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to fetch identity data. Status: ${resp.status}, Body: ${text}`);
  }

  const data: SigmaIdentityAPIResponse = await resp.json();
  if (data.status !== 'OK' || !data.result || data.error) {
    throw new Error(
      `Sigma Identity returned invalid data for ${bapId}: ${data.error || 'Unknown error'}`
    );
  }

  const bapIdentity = sigmaIdentityToBapIdentity(data.result);

  await saveToRedis<CacheValue>(cacheKey, {
    type: 'signer',
    value: bapIdentity,
  });

  return bapIdentity;
}

// Validation helper for signer data
export function validateSignerData(signer: BapIdentity): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!signer.idKey) errors.push('Missing idKey');
  if (!signer.currentAddress) errors.push('Missing currentAddress');
  if (!signer.rootAddress) errors.push('Missing rootAddress');
  if (!signer.addresses || !signer.addresses.length) errors.push('Missing addresses');

  return {
    isValid: errors.length === 0,
    errors,
  };
}
