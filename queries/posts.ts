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
        // Count total likes first (including those without emoji)
        {
            $addFields: {
                totalLikesCount: { $size: '$likes' }
            }
        },
        // Then unwind to process emoji reactions
        { $unwind: { path: '$likes', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: {
                    postId: '$_id',
                    emoji: { $arrayElemAt: ['$likes.MAP.emoji', 0] } // Extract first element of emoji array
                },
                post: { $first: '$$ROOT' }, // Always keep the original document
                // Count reactions only where emoji exists
                count: { 
                    $sum: { 
                        $cond: [
                            { $and: [
                                { $ne: [{ $arrayElemAt: ['$likes.MAP.emoji', 0] }, null] },
                                { $ne: [{ $arrayElemAt: ['$likes.MAP.emoji', 0] }, undefined] }
                            ]}, 
                            1, 
                            0
                        ] 
                    } 
                }
            }
        },
        {
            $group: {
                _id: '$_id.postId',
                post: { $first: '$post' },
                // Use the pre-calculated total likes count
                totalLikes: { $first: '$post.totalLikesCount' },
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
        // Count total likes first (including those without emoji)
        {
            $addFields: {
                totalLikesCount: { $size: '$likes' }
            }
        },
        // Then unwind to process emoji reactions
        { $unwind: { path: '$likes', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: {
                    postId: '$_id',
                    emoji: { $arrayElemAt: ['$likes.MAP.emoji', 0] } // Extract first element of emoji array
                },
                post: { $first: '$$ROOT' }, // Always keep the original document
                // Count reactions only where emoji exists
                count: { 
                    $sum: { 
                        $cond: [
                            { $and: [
                                { $ne: [{ $arrayElemAt: ['$likes.MAP.emoji', 0] }, null] },
                                { $ne: [{ $arrayElemAt: ['$likes.MAP.emoji', 0] }, undefined] }
                            ]}, 
                            1, 
                            0
                        ] 
                    } 
                }
            }
        },
        {
            $group: {
                _id: '$_id.postId',
                post: { $first: '$post' },
                // Use the pre-calculated total likes count
                totalLikes: { $first: '$post.totalLikesCount' },
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

    const [results, count] = await Promise.all([
        dbo.collection('post').aggregate(aggregationPipeline).toArray(),
        dbo.collection('post').countDocuments({ "MAP.tx": txid, "MAP.context": "tx" }),
    ]);

    const signerAddresses = new Set<string>();
    for (const msg of results) {
        if (!msg.post?.AIP) continue;
        for (const aip of msg.post.AIP) {
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
        results: results.map((doc) => ({
            ...doc.post,
            tx: { h: doc.post.tx?.h || '' },
            blk: doc.post.blk || { i: 0, t: 0 },
            timestamp: doc.post.timestamp || doc.post.blk?.t || Math.floor(Date.now() / 1000),
            MAP: doc.post.MAP,
            B: doc.post.B?.map((b) => ({
                encoding: b?.encoding || '',
                content: b?.content || '',
                "content-type": (b && b['content-type']) || '',
            })) || [],
        })),
        signers,
        meta: results.map(doc => doc.meta)
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
        // Count total likes first (including those without emoji)
        {
            $addFields: {
                totalLikesCount: { $size: '$likes' }
            }
        },
        // Then unwind to process emoji reactions
        { $unwind: { path: '$likes', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: {
                    postId: '$_id',
                    emoji: { $arrayElemAt: ['$likes.MAP.emoji', 0] }
                },
                post: { $first: '$$ROOT' },
                // Count reactions only where emoji exists
                count: { 
                    $sum: { 
                        $cond: [
                            { $and: [
                                { $ne: [{ $arrayElemAt: ['$likes.MAP.emoji', 0] }, null] },
                                { $ne: [{ $arrayElemAt: ['$likes.MAP.emoji', 0] }, undefined] }
                            ]}, 
                            1, 
                            0
                        ] 
                    } 
                }
            }
        },
        {
            $group: {
                _id: '$_id.postId',
                post: { $first: '$post' },
                // Use the pre-calculated total likes count
                totalLikes: { $first: '$post.totalLikesCount' },
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

    const [results, count] = await Promise.all([
        dbo.collection('post').aggregate(aggregationPipeline).toArray(),
        dbo.collection('post').countDocuments(query),
    ]);

    // Get unique signer addresses
    const signerAddresses = new Set<string>();
    for (const doc of results) {
        if (!doc.post?.AIP) continue;
        for (const aip of doc.post.AIP) {
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
        results: results.map((doc) => ({
            ...doc.post,
            tx: { h: doc.post.tx?.h || '' },
            blk: doc.post.blk || { i: 0, t: 0 },
            timestamp: doc.post.timestamp || doc.post.blk?.t || Math.floor(Date.now() / 1000),
            MAP: doc.post.MAP,
            B: doc.post.B?.map((b) => ({
                encoding: b?.encoding || '',
                content: b?.content || '',
                "content-type": (b && b['content-type']) || '',
            })) || [],
        })),
        signers,
        meta: results.map(doc => doc.meta)
    };
}
