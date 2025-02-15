import type { B, BmapTx } from 'bmapjs';

interface AIPWithAlgorithmSigningComponent {
  algorithm_signing_component?: string;
  address?: string;
}

interface BWithData {
  Data?: {
    utf8?: string;
    data?: string;
  };
  content?: string;
}

// Match the Golang Bmap structure
export const unNormalize = (tx: BmapTx): BmapTx => {
  if (tx.B) {
    tx.B = tx.B.map((b: BmapTx['B'][number]) => {
      if (b.content) {
        const data = Object.assign(
          {},
          b.encoding === 'binary' ? { data: b.content } : { utf8: b.content }
        );

        b.Data = data;
        b.content = undefined;
        return b;
      }
    });
  }
  return tx;
};

// Nromalize to use "content" which is always populated instead of "Data" or "data"
export const normalize = (tx: BmapTx): BmapTx => {
  if (tx.AIP) {
    const aip = tx.AIP.map((a: AIPWithAlgorithmSigningComponent) => {
      if (!a.address && a.algorithm_signing_component) {
        a.address = a.algorithm_signing_component;
      }
      return a;
    });
    tx.AIP = aip;
  }

  if (tx.B) {
    for (let i = 0; i < tx.B?.length; i++) {
      const b = tx.B[i] as BWithData;
      if (!b.content && (b.Data?.utf8 || b.Data?.data)) {
        b.content = b.Data.utf8 || b.Data.data;
      }
      tx.B[i] = b as B;
    }
  }

  return tx;
};
