import type { BmapTx } from 'bmapjs';
import { getBAPIdByAddress, getSigners, type BapIdentity } from '../bap.js';
import { getDbo } from '../db.js';
import { fetchBapIdentityData } from '../social/queries/identity.js';

export interface PostsParams {
    bapId?: string;
    address?: string;
    page: number;
    limit: number;
}

export interface RepliesParams {
    txid?: string;
    page: number;
    limit: number;
}

export interface PostsResponse {
    bapID?: string;
    page: number;
    limit: number;
    count: number;
    results: BmapTx[];
    signers: BapIdentity[];
    likes?: {
        tx: string;
        likes: number;
    }[];
    replies?: number;
}

export interface PostResponse {
    post: BmapTx;
    signers: BapIdentity[];
    likes: number;
}

export async function getPost(txid: string): Promise<PostResponse> {
    const dbo = await getDbo();

    const aggregationPipeline = [
        { $match: { _id: txid } },
        {
            $lookup: {
                from: 'like',
                localField: '_id',
                foreignField: 'MAP.tx',
                as: 'likes',
            },
        },
        {
            $addFields: {
                likes: { $size: '$likes' },
            },
        },
    ];

    const post = await dbo.collection<BmapTx>('post').aggregate(aggregationPipeline).toArray();

    if (!post.length) {
        throw new Error(`Post with txid ${txid} not found`);
    }

    const signerAddresses = new Set<string>();
    for (const aip of post[0].AIP || []) {
        if (aip.address) {
            signerAddresses.add(aip.address);
        }
    }

    const signers = await getSigners([...signerAddresses]);

    return {
        post: {
            ...post[0],
            likes: undefined,
            tx: { h: post[0].tx?.h || '' },
            blk: post[0].blk || { i: 0, t: 0 },
            timestamp: post[0].timestamp || post[0].blk?.t || Math.floor(Date.now() / 1000),
            MAP: post[0].MAP.map((m) => ({
                ...m,
                bapID: m.bapID || '',
            })),
            B: post[0].B?.map((b) => ({
                encoding: b?.encoding || '',
                content: b?.content || '',
                "content-type": (b && b['content-type']) || '',
            })) || [],
        },
        signers,
        likes: post[0].likes,
    };
}

export async function getReplies({
    txid,
    page = 1,
    limit = 100,
}: RepliesParams): Promise<PostsResponse> {
    const dbo = await getDbo();
    const skip = (page - 1) * limit;

    const query: any = {
        "MAP.tx": txid,
        "MAP.context": "tx",
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
    const signers = await getSigners([...signerAddresses])
    
    console.log('Results:', results)
    return {
        page,
        limit,
        count,
        results: results.map((msg) => ({
            ...msg,
            tx: { h: msg.tx?.h || '' },
            blk: msg.blk || { i: 0, t: 0 },
            timestamp: msg.timestamp || msg.blk?.t || Math.floor(Date.now() / 1000),
            MAP: msg.MAP,
            B: msg.B?.map((b) => ({
                encoding: b?.encoding || '',
                content: b?.content || '',
                "content-type": (b && b['content-type']) || ''
            })) || [],
        })),
        signers,
        likes: results.map(result => ({
            tx: result._id.toString(),
            likes: result.likes,
        }))
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

    const query: {
        "AIP.address"?: string | { $in: string[] };
    } = {};
    if (address) {
        query['AIP.address'] = address;
    } else if (bapId) {
        const identity = await fetchBapIdentityData(bapId);
        if (!identity?.currentAddress) {
            console.log('No current address found for BAP ID:', bapId, identity);
            throw new Error('Invalid BAP identity data');
        }
        query['AIP.address'] = { $in: identity.addresses.map(a => a.address) };
    }

    console.log('Querying posts with params:', query, 'page:', page, 'limit:', limit);

    const aggregationPipeline = [
        { $match: query },
        { $sort: { 'timestamp': -1 } },
        { $skip: skip },
        { $limit: limit },
        {
            $lookup: {
                from: 'like',
                localField: '_id',
                foreignField: 'MAP.tx',
                as: 'likes',
            },
        },
        {
            $addFields: {
                likes: { $size: '$likes' },
            },
        },
    ];

    const [results, count] = await Promise.all([
        dbo.collection('post').aggregate(aggregationPipeline).toArray(),
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
    const signers = await getSigners([...signerAddresses]);

    return {
        bapID: bapId,
        page,
        limit,
        count,
        results: results.map((msg) => ({
            ...msg,
            likes: undefined,
            tx: { h: msg.tx?.h || '' },
            blk: msg.blk || { i: 0, t: 0 },
            timestamp: msg.timestamp || msg.blk?.t || Math.floor(Date.now() / 1000),
            MAP: msg.MAP,
            B: msg.B?.map((b) => ({
                encoding: b?.encoding || '',
                content: b?.content || '',
                "content-type": (b && b['content-type']) || '',
            })) || [],
        })),
        signers,
        likes: results.map(result => ({
            tx: result._id,
            likes: result.likes,
        }))
    };
}
