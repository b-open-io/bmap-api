import type { BmapTx } from 'bmapjs';
import { getBAPIdByAddress, type BapIdentity } from '../bap.js';
import { getDbo } from '../db.js';
import { fetchBapIdentityData } from '../social/queries/identity.js';

interface PostsParams {
    bapId?: string;
    address?: string;
    page: number;
    limit: number;
}

export interface PostsResponse {
    bapID: string;
    page: number;
    limit: number;
    count: number;
    results: BmapTx[];
    signers: BapIdentity[];
}

export interface PostResponse {
    post: BmapTx;
    signers: BapIdentity[];
}

export async function getPost(txid: string): Promise<PostResponse> {
    const dbo = await getDbo();
    const post = await dbo.collection<BmapTx>('post').findOne({_id: txid});

    if (!post) {
        throw new Error(`Post with txid ${txid} not found`);
    }
    // Get unique signer addresses
    const signerAddresses = new Set<string>();
    for (const aip of post.AIP) {
        if (aip.address) {
            signerAddresses.add(aip.address);
        }
    }

    // Get BAP identities for all signers
    const signers = await Promise.all(
        Array.from(signerAddresses).map((address) => getBAPIdByAddress(address))
    );

    return {
        post: {
            ...post,
            tx: { h: post.tx?.h || '' },
            blk: post.blk || { i: 0, t: 0 },
            timestamp: post.timestamp || post.blk?.t || Math.floor(Date.now() / 1000),
            MAP: post.MAP.map((m) => ({
                ...m,
                bapID: m.bapID || '',
            })),
            B: post.B?.map((b) => ({
                encoding: b?.encoding || '',
                content: b?.content || '',
                "content-type": (b && b['content-type']) || ''
            })) || [],
        },
        signers: signers.filter(s => s).map((s) => ({
            idKey: s.idKey,
            rootAddress: s.rootAddress,
            currentAddress: s.currentAddress,
            addresses: s.addresses,
            block: s.block || 0,
            timestamp: s.timestamp || 0,
            valid: s.valid ?? true,
            identityTxId: s.identityTxId || '',
            identity: typeof s.identity === 'string' ? s.identity : JSON.stringify(s.identity) || '',
        })),
    };
}

export async function getPosts({
    bapId,
    address,
    page = 1,
    limit = 100,
}: PostsParams): Promise<PostsResponse> {
    const dbo = await getDbo();
    const skip = (page - 1) * limit;

    const query: any = {}
    if (address) {
        query['AIP.address'] = address;
    } else if (bapId) {
        const identity = await fetchBapIdentityData(bapId);
        if (!identity?.currentAddress) {
            console.log('No current address found for BAP ID:', bapId, identity);
            throw new Error('Invalid BAP identity data');
        }
        query['AIP.address'] = identity.currentAddress;
    }

    console.log('Querying posts with params:', query, 'page:', page, 'limit:', limit);
    const [results, count] = await Promise.all([
        dbo.collection('post')
            .find(query)
            .sort({ 'timestamp': -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        dbo.collection('post').countDocuments(query),
    ]);

    // Get unique signer addresses
    const signerAddresses = new Set<string>();
    for (const msg of results) {
        if (!msg.AIP) continue;
        for (const aip of msg.AIP) {
            if (aip.address) {
                signerAddresses.add(aip.address);
            }
        }
    }

    // Get BAP identities for all signers
    const signers = await Promise.all(
        Array.from(signerAddresses).map((address) => getBAPIdByAddress(address))
    );

    console.log('Results:', results)
    return {
        bapID: bapId,
        page,
        limit,
        count,
        results: results.map((msg) => ({
            ...msg,
            tx: { h: msg.tx?.h || '' },
            blk: msg.blk || { i: 0, t: 0 },
            timestamp: msg.timestamp || msg.blk?.t || Math.floor(Date.now() / 1000),
            MAP: msg.MAP.map((m) => ({
                ...m,
                bapID: m.bapID || '',
            })),
            B: msg.B?.map((b) => ({
                encoding: b?.encoding || '',
                content: b?.content || '',
                "content-type": (b && b['content-type']) || ''
            })) || [],
        })),
        signers: signers.map((s) => ({
            idKey: s.idKey,
            rootAddress: s.rootAddress,
            currentAddress: s.currentAddress,
            addresses: s.addresses,
            block: s.block || 0,
            timestamp: s.timestamp || 0,
            valid: s.valid ?? true,
            identityTxId: s.identityTxId || '',
            identity: typeof s.identity === 'string' ? s.identity : JSON.stringify(s.identity) || '',
        })),
    };
}
