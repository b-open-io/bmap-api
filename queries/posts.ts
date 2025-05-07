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
    meta?: Meta[];
}

export interface Meta {
    tx: string;
    likes: number;
    reactions: {
        emoji: string;
        count: number;
    }[],
    replies: number;
}

export interface PostResponse {
    post: BmapTx;
    signers: BapIdentity[];
    meta: Meta;
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
        { $unwind: { path: '$likes', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$_id',
                post: { $first: '$$ROOT' },
                totalLikes: { $sum: 1 },
                reactions: {
                    $push: {
                        emoji: '$likes.MAP.emoji',
                        count: { $sum: 1 },
                    },
                },
            },
        },
        {
            $lookup: {
                from: 'post',
                let: { postId: '$_id' },
                pipeline: [
                    { $match: { $expr: { $and: [{ $eq: ['$MAP.tx', '$$postId'] }, { $eq: ['$MAP.context', 'tx'] }] } } },
                ],
                as: 'replies',
            },
        },
        {
            $addFields: {
                'post.meta.tx': '$post.tx.h', // Populate meta.tx with tx.h
                'post.meta.likes': '$totalLikes',
                'post.meta.reactions': '$reactions',
                'post.meta.replies': { $size: '$replies' },
            },
        },
        { $replaceRoot: { newRoot: '$post' } },
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
            meta: undefined,
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
        meta: post[0].meta,
    };
}

export async function getReplies({
    txid,
    page = 1,
    limit = 100,
}: RepliesParams): Promise<PostsResponse> {
    const dbo = await getDbo();
    const skip = (page - 1) * limit;

    const aggregationPipeline = [
        { $match: { "MAP.tx": txid, "MAP.context": "tx" } },
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
        { $unwind: { path: '$likes', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$_id',
                post: { $first: '$$ROOT' },
                totalLikes: { $sum: 1 },
                reactions: {
                    $push: {
                        emoji: '$likes.MAP.emoji',
                        count: { $sum: 1 },
                    },
                },
            },
        },
        {
            $lookup: {
                from: 'post',
                let: { postId: '$_id' },
                pipeline: [
                    { $match: { $expr: { $and: [{ $eq: ['$MAP.tx', '$$postId'] }, { $eq: ['$MAP.context', 'tx'] }] } } },
                ],
                as: 'replies',
            },
        },
        {
            $addFields: {
                'post.meta.tx': '$post.tx.h', // Populate meta.tx with tx.h
                'post.meta.likes': '$totalLikes',
                'post.meta.reactions': '$reactions',
                'post.meta.replies': { $size: '$replies' },
            },
        },
        { $replaceRoot: { newRoot: '$post' } },
    ];

    const [results, count] = await Promise.all([
        dbo.collection('post').aggregate(aggregationPipeline).toArray(),
        dbo.collection('post').countDocuments({ "MAP.tx": txid, "MAP.context": "tx" }),
    ]);

    const signerAddresses = new Set<string>();
    for (const msg of results) {
        if (!msg.AIP) continue;
        for (const aip of msg.AIP) {
            if (aip.address) {
                signerAddresses.add(aip.address);
            }
        }
    }

    const signers = await getSigners([...signerAddresses]);

    return {
        page,
        limit,
        count,
        results: results.map((msg) => ({
            ...msg,
            meta: undefined,
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
        meta: results.map(result => result.meta)
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
        { $unwind: { path: '$likes', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$_id',
                post: { $first: '$$ROOT' },
                totalLikes: { $sum: 1 },
                reactions: {
                    $push: {
                        emoji: '$likes.MAP.emoji',
                        count: { $sum: 1 },
                    },
                },
            },
        },
        {
            $lookup: {
                from: 'post',
                let: { postId: '$_id' },
                pipeline: [
                    { $match: { $expr: { $and: [{ $eq: ['$MAP.tx', '$$postId'] }, { $eq: ['$MAP.context', 'tx'] }] } } },
                ],
                as: 'replies',
            },
        },
        {
            $addFields: {
                'post.meta.tx': '$post.tx.h', // Populate meta.tx with tx.h
                'post.meta.likes': '$totalLikes',
                'post.meta.reactions': '$reactions',
                'post.meta.replies': { $size: '$replies' },
            },
        },
        { $replaceRoot: { newRoot: '$post' } },
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
            meta: undefined,
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
        meta: results.map(result => result.meta)
    };
}
