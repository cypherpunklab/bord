import { getBlock, getBlockHashByHeight } from './src/utils';

function subsidy(height: number) {
  return (
    (BigInt(50) * BigInt(100_000_000)) >> (BigInt(height) / BigInt(210_000n))
  );
}

function firstOrdinal(height: number) {
  let start = BigInt(0);
  for (let i = 0; i < height; i++) {
    start += subsidy(Number(i));
  }
  return start;
}

function assignOrdinals(height: number) {
  const first = firstOrdinal(height);
  const last = first + subsidy(height);
  let coinbaseOrdinals: bigint[] = Array.from(
    { length: Number(last - first) },
    (_, i) => first + BigInt(i)
  );

  const blockHash = await getBlockHashByHeight(height);
  const block = await getBlock(blockHash);

  for (const tx of block.tx) {
    const ordinals: bigint[] = [];
    for (const input of transaction.inputs) {
      ordinals.push(...input.ordinals);
    }

    for (const output of transaction.outputs) {
      output.ordinals = ordinals.slice(0, Number(output.value));
      ordinals.splice(0, Number(output.value));
    }

    coinbaseOrdinals.push(...ordinals);
  }

  for (const output of block.transactions[0].outputs) {
    output.ordinals = coinbaseOrdinals.slice(0, Number(output.value));
    coinbaseOrdinals.splice(0, Number(output.value));
  }
}
