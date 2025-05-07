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
                _id: {
                    postId: '$_id',
                    emoji: { $arrayElemAt: ['$likes.MAP.emoji', 0] } // Extract first element of emoji array
                },
                post: { $first: '$$ROOT' }, // Always keep the original document
                count: { $sum: { $cond: [{ $ne: [{ $arrayElemAt: ['$likes.MAP.emoji', 0] }, null] }, 1, 0] } }
            }
        },
        {
            $group: {
                _id: '$_id.postId',
                post: { $first: '$post' },
                totalLikes: { $sum: '$count' },
                reactions: {
                    $push: {
                        $cond: [
                            { $and: [
                                { $ne: ['$_id.emoji', null] },
                                { $ne: ['$_id.emoji', undefined] }
                            ]},
                            {
                                emoji: '$_id.emoji',
                                count: '$count'
                            },
                            "$$REMOVE"
                        ]
                    }
                }
            }
        },
        {
            $lookup: {
                from: 'post',
                localField: '_id',
                foreignField: 'MAP.tx',
                as: 'replies',
            },
        },
        {
            $addFields: {
                meta: {
                    tx: '$post.tx.h',
                    likes: '$totalLikes',
                    reactions: {
                        $filter: {
                            input: '$reactions',
                            as: 'reaction',
                            cond: { 
                                $and: [
                                    { $ne: ['$$reaction.emoji', null] },
                                    { $gt: ['$$reaction.count', 0] }
                                ]
                            }
                        }
                    },
                    replies: { $size: '$replies' }
                }
            }
        }
    ];

    const posts = await dbo.collection<BmapTx>('post').aggregate(aggregationPipeline).toArray();

    if (!posts.length) {
        throw new Error(`Post with txid ${txid} not found`);
    }

    console.log('Post found:', posts[0]);
    const {post, meta} = posts[0];
    const signerAddresses = new Set<string>();
    for (const aip of post.AIP || []) {
        if (aip.address) {
            signerAddresses.add(aip.address);
        }
    }

    const signers = await getSigners([...signerAddresses]);

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
                "content-type": (b && b['content-type']) || '',
            })) || [],
        },
        signers,
        meta,
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
                _id: {
                    postId: '$_id',
                    emoji: { $arrayElemAt: ['$likes.MAP.emoji', 0] } // Extract first element of emoji array
                },
                post: { $first: { $cond: [{ $eq: [{ $arrayElemAt: ['$likes.MAP.emoji', 0] }, null] }, '$$ROOT', '$post'] } },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.postId',
                post: { $first: '$post' },
                totalLikes: { $sum: '$count' },
                reactions: {
                    $push: {
                        $cond: [
                            { $ne: ['$_id.emoji', null] },
                            {
                                emoji: '$_id.emoji',
                                count: '$count'
                            },
                            "$$REMOVE"
                        ]
                    }
                }
            }
        },
        {
            $lookup: {
                from: 'post',
                localField: '_id',
                foreignField: 'MAP.tx',
                as: 'replies',
            },
        },
        {
            $addFields: {
                'post.meta.tx': '$post.tx.h',
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
        { $sort: { timestamp: -1 } },
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
                _id: {
                    postId: '$_id',
                    emoji: { $arrayElemAt: ['$likes.MAP.emoji', 0] } // Extract first element of emoji array
                },
                post: { $first: { $cond: [{ $eq: [{ $arrayElemAt: ['$likes.MAP.emoji', 0] }, null] }, '$$ROOT', '$post'] } },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.postId',
                post: { $first: '$post' },
                totalLikes: { $sum: '$count' },
                reactions: {
                    $push: {
                        $cond: [
                            { $ne: ['$_id.emoji', null] },
                            {
                                emoji: '$_id.emoji',
                                count: '$count'
                            },
                            "$$REMOVE"
                        ]
                    }
                }
            }
        },
        {
            $lookup: {
                from: 'post',
                localField: '_id',
                foreignField: 'MAP.tx',
                as: 'replies',
            },
        },
        {
            $addFields: {
                'post.meta.tx': '$post.tx.h',
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
