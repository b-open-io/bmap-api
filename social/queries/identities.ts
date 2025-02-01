import type { BapIdentity } from '../../bap.js';
import type { CacheError, CacheValue } from '../../cache.js';
import { client, readFromRedis, saveToRedis } from '../../cache.js';
import { getBAPIdByAddress } from '../../bap.js';
import { validateSignerData } from './identity.js';

export async function getAllIdentities(): Promise<BapIdentity[]> {
  // Check Redis connection
  console.log('Checking Redis connection...');
  if (!client.isReady) {
    console.error('Redis client is not ready');
    return [];
  }

  // First try to get the cached identities list
  const identitiesCacheKey = 'identities';
  const cachedIdentities = await readFromRedis<CacheValue | CacheError>(identitiesCacheKey);

  if (cachedIdentities?.type === 'identities' && Array.isArray(cachedIdentities.value)) {
    console.log('Using cached identities list');
    return cachedIdentities.value;
  }

  // If no cached list, get all signer-* keys from Redis
  console.log('No cached identities list, checking individual signer caches');
  const signerKeys = await client.keys('signer-*');
  console.log(`Found ${signerKeys.length} cached signers`);

  if (!signerKeys.length) {
    console.log('No cached signers found');
    return [];
  }

  // Get all cached signers
  const identities = await Promise.all(
    signerKeys.map(async (key) => {
      try {
        const cachedValue = await readFromRedis<CacheValue | CacheError>(key);
        if (cachedValue?.type === 'signer' && 'value' in cachedValue) {
          const identity = cachedValue.value;
          if (identity && validateSignerData(identity).isValid) {
            return {
              idKey: identity.idKey || '',
              rootAddress: identity.rootAddress || '',
              currentAddress: identity.currentAddress || '',
              addresses: Array.isArray(identity.addresses)
                ? identity.addresses.map((addr) => ({
                    address: addr.address || '',
                    txId: addr.txId || '',
                    block: typeof addr.block === 'number' ? addr.block : undefined,
                  }))
                : [],
              identity:
                typeof identity.identity === 'string'
                  ? identity.identity
                  : typeof identity.identity === 'object'
                    ? identity.identity
                    : JSON.stringify(identity.identity || {}),
              identityTxId: identity.identityTxId || '',
              block: typeof identity.block === 'number' ? identity.block : 0,
              timestamp: typeof identity.timestamp === 'number' ? identity.timestamp : 0,
              valid: typeof identity.valid === 'boolean' ? identity.valid : true,
            };
          }
        }
        return null;
      } catch (error) {
        console.error(`Error processing cached signer ${key}:`, error);
        return null;
      }
    })
  );

  const filteredIdentities = identities.filter((id): id is BapIdentity => {
    if (!id) return false;
    return (
      typeof id.idKey === 'string' &&
      typeof id.rootAddress === 'string' &&
      typeof id.currentAddress === 'string' &&
      Array.isArray(id.addresses) &&
      id.addresses.every(
        (addr) =>
          typeof addr.address === 'string' &&
          typeof addr.txId === 'string' &&
          (typeof addr.block === 'number' || addr.block === undefined)
      ) &&
      (typeof id.identity === 'string' || typeof id.identity === 'object') &&
      typeof id.identityTxId === 'string' &&
      typeof id.block === 'number' &&
      typeof id.timestamp === 'number' &&
      typeof id.valid === 'boolean'
    );
  });

  console.log('\n=== Identity Processing Summary ===');
  console.log('Total cached signers:', signerKeys.length);
  console.log('Successfully processed:', filteredIdentities.length);
  console.log('Failed/invalid:', signerKeys.length - filteredIdentities.length);

  // Cache the filtered list
  await saveToRedis<CacheValue>(identitiesCacheKey, {
    type: 'identities',
    value: filteredIdentities,
  });

  return filteredIdentities;
}
