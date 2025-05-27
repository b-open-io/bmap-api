import { parse } from 'bpu-ts';

export type JBJsonTxResp = {
  id: string;
  transaction: string;
  block_hash: string;
  block_height: number;
  block_time: number;
  block_index: number;
  addresses: string[];
  inputs: string[];
  outputs: string[];
  input_types: string[];
  output_types: string[];
};

// Transaction utility functions
export const bobFromRawTx = async (rawtx: string) => {
  try {
    const result = await parse({
      tx: { r: rawtx },
      split: [{ token: { op: 106 }, include: 'l' }, { token: { s: '|' } }],
    });
    if (!result) throw new Error('No result from parsing transaction');
    return result;
  } catch (error) {
    console.error('Error parsing raw transaction:', error);
    throw new Error(
      `Failed to parse transaction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

export const jsonFromTxid = async (txid: string): Promise<JBJsonTxResp> => {
  try {
    // const url = `https://api.whatsonchain.com/v1/bsv/main/tx/${txid}`;
    const url = `https://junglebus.gorillapool.io/v1/transaction/get/${txid}`;
    console.log('Fetching from JB:', url);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`WhatsonChain request failed: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as JBJsonTxResp;
    return json;
  } catch (error) {
    console.error('Error fetching from WhatsonChain:', error);
    throw new Error(
      `Failed to fetch from WhatsonChain: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

export const rawTxFromTxid = async (txid: string) => {
  try {
    // const url = `https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`;
    const url = `https://junglebus.gorillapool.io/v1/transaction/get/${txid}/hex`;
    console.log('Fetching raw tx from JB:', url);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`JB request failed: ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    if (!text) {
      throw new Error('Empty response from JB');
    }
    return text;
  } catch (error) {
    console.error('Error fetching raw tx from JB:', error);
    throw new Error(
      `Failed to fetch raw tx: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

export const bobFromTxid = async (txid: string) => {
  try {
    const rawtx = await rawTxFromTxid(txid);
    try {
      return await bobFromRawTx(rawtx);
    } catch (e) {
      throw new Error(
        `Failed to get rawtx from whatsonchain for ${txid}: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  } catch (error) {
    console.error('Error in bobFromTxid:', error);
    throw new Error(
      `Failed to process transaction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};