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
        // Step 1: Match the posts we want
        { $match: { _id: txid } },

        // Step 2: Put the post in a property called "post"
        {
            $replaceRoot: {
                newRoot: {
                    post: "$$ROOT" // Store the entire document as "post"
                }
            }
        },

        // Step 3: Lookup to get replies
        {
            $lookup: {
                from: 'post',
                localField: 'post._id',
                foreignField: 'MAP.tx',
                as: 'replies',
            },
        },

        // Step 4: Lookup to get likes
        {
            $lookup: {
                from: 'like',
                localField: 'post._id',
                foreignField: 'MAP.tx',
                as: 'likes',
            },
        },

        // Step 5: Calculate total likes before unwinding
        {
            $addFields: {
                totalLikes: { $size: { $ifNull: ['$likes', []] } } // Count the total number of likes
            }
        },

        // Step 6: Unwind likes to process emoji reactions
        { $unwind: { path: '$likes', preserveNullAndEmptyArrays: true } },

        // Step 7: Group by post ID and emoji to count reactions
        {
            $group: {
                _id: {
                    postId: '$post._id',
                    emoji: { $arrayElemAt: ['$likes.MAP.emoji', 0] } // Extract the first element of the emoji array
                },
                post: { $first: '$post' },
                replies: { $first: '$replies' }, // Preserve the replies field
                totalLikes: { $first: '$totalLikes' }, // Preserve the total likes count
                count: {
                    $sum: {
                        $cond: [
                            { $and: [
                                { $ne: ['$likes.MAP.emoji', null] },
                                { $ne: ['$likes.MAP.emoji', undefined] },
                                { $ne: ['$likes.MAP.emoji', ''] } // Exclude empty strings
                            ]},
                            1,
                            0
                        ]
                    }
                }
            }
        },

        // Step 8: Group by post ID to consolidate reactions
        {
            $group: {
                _id: '$_id.postId',
                post: { $first: '$post' },
                replies: { $first: '$replies' }, // Preserve the replies field
                totalLikes: { $first: '$totalLikes' }, // Preserve the total likes count
                reactions: {
                    $push: {
                        $cond: [
                            { $and: [
                                { $ne: ['$_id.emoji', null] },
                                { $ne: ['$_id.emoji', undefined] },
                                { $ne: ['$_id.emoji', ''] },
                                { $ifNull: ['$_id.emoji', false] }
                            ]},
                            {
                                emoji: '$_id.emoji', // Use the flattened emoji value
                                count: '$count'
                            },
                            "$$REMOVE" // Exclude likes without a valid emoji
                        ]
                    }
                }
            }
        },

        // Step 9: Add the meta property with replies, likes, and reactions
        {
            $addFields: {
                meta: {
                    tx: "$post.tx.h",
                    replies: { $size: { $ifNull: ['$replies', []] } }, // Count the number of replies
                    likes: '$totalLikes', // Use the pre-calculated total likes count
                    reactions: '$reactions' // Add the reactions array
                }
            }
        }
    ];

    const posts = await dbo.collection<BmapTx>('post').aggregate(aggregationPipeline).toArray();

    if (!posts.length) {
        throw new Error(`Post with txid ${txid} not found`);
    }

    const { post, meta } = posts[0];
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
    const query = { "MAP.tx": txid }


    // Start with a basic pipeline
    const aggregationPipeline = [
        // Step 1: Match the posts we want
        { $match: query },

        // Step 2: Sort by timestamp descending (newest first)
        { $sort: { timestamp: -1 } },

        // Step 3: Pagination
        { $skip: skip },
        { $limit: limit },

        // Step 4: Put the post in a property called "post"
        {
            $replaceRoot: {
                newRoot: {
                    post: "$$ROOT" // Store the entire document as "post"
                }
            }
        },

        // Step 5: Lookup to get replies
        {
            $lookup: {
                from: 'post',
                localField: 'post._id',
                foreignField: 'MAP.tx',
                as: 'replies',
            },
        },

        // Step 6: Lookup to get likes
        {
            $lookup: {
                from: 'like',
                localField: 'post._id',
                foreignField: 'MAP.tx',
                as: 'likes',
            },
        },

        // Step 7: Calculate total likes before unwinding
        {
            $addFields: {
                totalLikes: { $size: { $ifNull: ['$likes', []] } } // Count the total number of likes
            }
        },

        // Step 8: Unwind likes to process emoji reactions
        { $unwind: { path: '$likes', preserveNullAndEmptyArrays: true } },

        // Step 9: Group by post ID and emoji to count reactions
        {
            $group: {
                _id: {
                    postId: '$post._id',
                    emoji: { $arrayElemAt: ['$likes.MAP.emoji', 0] } // Extract the first element of the emoji array
                },
                post: { $first: '$post' },
                replies: { $first: '$replies' }, // Preserve the replies field
                totalLikes: { $first: '$totalLikes' }, // Preserve the total likes count
                count: {
                    $sum: {
                        $cond: [
                            { $and: [
                                { $ne: ['$likes.MAP.emoji', null] },
                                { $ne: ['$likes.MAP.emoji', undefined] },
                                { $ne: ['$likes.MAP.emoji', ''] } // Exclude empty strings
                            ]},
                            1,
                            0
                        ]
                    }
                }
            }
        },

        // Step 10: Group by post ID to consolidate reactions
        {
            $group: {
                _id: '$_id.postId',
                post: { $first: '$post' },
                replies: { $first: '$replies' }, // Preserve the replies field
                totalLikes: { $first: '$totalLikes' }, // Preserve the total likes count
                reactions: {
                    $push: {
                        $cond: [
                            { $and: [
                                { $ne: ['$_id.emoji', null] },
                                { $ne: ['$_id.emoji', undefined] },
                                { $ne: ['$_id.emoji', ''] },
                                { $ifNull: ['$_id.emoji', false] }
                            ]},
                            {
                                emoji: '$_id.emoji', // Use the flattened emoji value
                                count: '$count'
                            },
                            "$$REMOVE" // Exclude likes without a valid emoji
                        ]
                    }
                }
            }
        },

        // Step 11: Add the meta property with replies, likes, and reactions
        {
            $addFields: {
                meta: {
                    tx: "$post.tx.h",
                    replies: { $size: { $ifNull: ['$replies', []] } }, // Count the number of replies
                    likes: '$totalLikes', // Use the pre-calculated total likes count
                    reactions: '$reactions' // Add the reactions array
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
        if (!doc.post.AIP) continue;
        for (const aip of doc.post.AIP) {
            if (aip.address) {
                signerAddresses.add(aip.address);
            }
        }
    }

    // Get BAP identities for all signers
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
        meta: results.map(doc => doc.meta) // We'll fill this in as we build the pipeline
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
        "MAP.tx": null;
        "AIP.address"?: string | { $in: string[] };
    } = {
        "MAP.tx": null
    };

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

    // Start with a basic pipeline
    const aggregationPipeline = [
        // Step 1: Match the posts we want
        { $match: query },

        // Step 2: Sort by timestamp descending (newest first)
        { $sort: { timestamp: -1 } },

        // Step 3: Pagination
        { $skip: skip },
        { $limit: limit },

        // Step 4: Put the post in a property called "post"
        {
            $replaceRoot: {
                newRoot: {
                    post: "$$ROOT" // Store the entire document as "post"
                }
            }
        },

        // Step 5: Lookup to get replies
        {
            $lookup: {
                from: 'post',
                localField: 'post._id',
                foreignField: 'MAP.tx',
                as: 'replies',
            },
        },

        // Step 6: Lookup to get likes
        {
            $lookup: {
                from: 'like',
                localField: 'post._id',
                foreignField: 'MAP.tx',
                as: 'likes',
            },
        },

        // Step 7: Calculate total likes before unwinding
        {
            $addFields: {
                totalLikes: { $size: { $ifNull: ['$likes', []] } } // Count the total number of likes
            }
        },

        // Step 8: Unwind likes to process emoji reactions
        { $unwind: { path: '$likes', preserveNullAndEmptyArrays: true } },

        // Step 9: Group by post ID and emoji to count reactions
        {
            $group: {
                _id: {
                    postId: '$post._id',
                    emoji: { $arrayElemAt: ['$likes.MAP.emoji', 0] } // Extract the first element of the emoji array
                },
                post: { $first: '$post' },
                replies: { $first: '$replies' }, // Preserve the replies field
                totalLikes: { $first: '$totalLikes' }, // Preserve the total likes count
                count: {
                    $sum: {
                        $cond: [
                            { $and: [
                                { $ne: ['$likes.MAP.emoji', null] },
                                { $ne: ['$likes.MAP.emoji', undefined] },
                                { $ne: ['$likes.MAP.emoji', ''] } // Exclude empty strings
                            ]},
                            1,
                            0
                        ]
                    }
                }
            }
        },

        // Step 10: Group by post ID to consolidate reactions
        {
            $group: {
                _id: '$_id.postId',
                post: { $first: '$post' },
                replies: { $first: '$replies' }, // Preserve the replies field
                totalLikes: { $first: '$totalLikes' }, // Preserve the total likes count
                reactions: {
                    $push: {
                        $cond: [
                            { $and: [
                                { $ne: ['$_id.emoji', null] },
                                { $ne: ['$_id.emoji', undefined] },
                                { $ne: ['$_id.emoji', ''] },
                                { $ifNull: ['$_id.emoji', false] }
                            ]},
                            {
                                emoji: '$_id.emoji', // Use the flattened emoji value
                                count: '$count'
                            },
                            "$$REMOVE" // Exclude likes without a valid emoji
                        ]
                    }
                }
            }
        },

        // Step 11: Add the meta property with replies, likes, and reactions
        {
            $addFields: {
                meta: {
                    tx: "$post.tx.h",
                    replies: { $size: { $ifNull: ['$replies', []] } }, // Count the number of replies
                    likes: '$totalLikes', // Use the pre-calculated total likes count
                    reactions: '$reactions' // Add the reactions array
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
        if (!doc.post.AIP) continue;
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
        meta: results.map(doc => doc.meta) // We'll fill this in as we build the pipeline
    };
}
