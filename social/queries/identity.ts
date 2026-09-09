import type { CacheValue } from '../../cache.js';
import { readFromRedis, saveToRedis } from '../../cache.js';
import { EXTERNAL_APIS } from '../../config/constants.js';
import type { BapIdentity } from '../../types.js';
import type { SigmaIdentityResult } from '../schemas.js';

export function sigmaIdentityToBapIdentity(result: SigmaIdentityResult): BapIdentity {
  return {
    idKey: result.idKey,
    rootAddress: result.rootAddress || '',
    currentAddress: result.currentAddress || '',
    addresses: (result.addresses ?? []).map((addr) =>
      typeof addr === 'string'
        ? { address: addr, txId: '', block: result.block }
        : { address: addr.address, txId: addr.txId ?? addr.txid, block: addr.block }
    ),
    identity: {
      ...(result.profile ?? result.identity ?? {}),
      '@type': 'Person',
      firstSeen: result.firstSeen ?? result.timestamp ?? 0,
    },
    identityTxId: result.identityTxId || '',
    block: result.block ?? 0,
    timestamp: result.timestamp ?? 0,
    valid: result.valid === true,
    firstSeen: result.firstSeen ?? result.timestamp ?? 0,
  };
}

export async function fetchBapIdentityData(bapId: string): Promise<BapIdentity | null> {
  const cacheKey = `sigmaIdentity-${bapId}`;
  const cached = await readFromRedis<CacheValue>(cacheKey);
  if (cached?.type === 'signer') {
    return cached.value;
  }

  const url = `${EXTERNAL_APIS.BAP}identity/get`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idKey: bapId }),
    signal: AbortSignal.timeout(10_000),
  });

  if (resp.status === 404) {
    console.warn(`BAP identity not found: ${bapId}`);
    return null;
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to fetch identity data. Status: ${resp.status}, Body: ${text}`);
  }

  const data = await resp.json();
  const result = data.status === 'OK' ? data.result : data;
  if (!result || typeof result.idKey !== 'string' || !Array.isArray(result.addresses))
    throw new Error('Identity API returned an invalid identity');
  const bapIdentity = sigmaIdentityToBapIdentity(result);

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
