import { Buffer } from 'buffer';
import { ScriptData, Tx } from '@cmdcode/tapscript';
import { exec } from 'child_process';
import { Block } from '../types/getBlock';

let pointer = 0;
let raw: any;
let network = '-regtest'; //TODO make this configurable

export const getBlockHeight = async () => {
  return new Promise((resolve, reject) => {
    exec(
      `bitcoin-cli ${network} getblockchaininfo`,
      (error, stdout, stderr) => {
        if (error) {
          console.log(`error: ${error.message}`);
          reject(error.message);
        }
        if (stderr) {
          console.log(`stderr: ${stderr}`);
          reject(stderr);
        }
        const blockchainInfo = JSON.parse(stdout);
        resolve(blockchainInfo.blocks as string);
      }
    );
  });
};

export const getBlockHash = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(
      `bitcoin-cli ${network} getblockchaininfo`,
      (error, stdout, stderr) => {
        if (error) {
          console.log(`error: ${error.message}`);
          reject(error.message);
        }
        if (stderr) {
          console.log(`stderr: ${stderr}`);
          reject(stderr);
        }
        const blockchainInfo = JSON.parse(stdout);
        resolve(blockchainInfo.bestblockhash as string);
      }
    );
  });
};

export const getBlock = async (blockHash: string): Promise<Block> => {
  return new Promise((resolve, reject) => {
    exec(
      `bitcoin-cli ${network} getblock ${blockHash}`,
      (error, stdout, stderr) => {
        if (error) {
          console.log(`error: ${error.message}`);
          reject(error.message);
        }
        if (stderr) {
          console.log(`stderr: ${stderr}`);
          reject(stderr);
        }
        const blockInfo = JSON.parse(stdout);
        resolve(blockInfo as Block);
      }
    );
  });
};

export const getBlockTime = async () => {
  return new Promise((resolve, reject) => {
    exec(
      `bitcoin-cli ${network} getblockchaininfo`, //TODO: change to RPC
      (error, stdout, stderr) => {
        if (error) {
          console.log(`error: ${error.message}`);
          reject(error.message);
        }
        if (stderr) {
          console.log(`stderr: ${stderr}`);
          reject(stderr);
        }
        const blockchainInfo = JSON.parse(stdout);
        const blockhash = blockchainInfo.bestblockhash as string;

        if (!blockhash) {
          reject('No block hash found');
        }
        exec(
          `bitcoin-cli ${network} getblock ${blockhash}`,
          (error, stdout, stderr) => {
            if (error) {
              console.log(`error: ${error.message}`);
              reject(error.message);
            }
            if (stderr) {
              console.log(`stderr: ${stderr}`);
              reject(stderr);
            }
            console.log(stdout);
            const blockInfo = JSON.parse(stdout);
            resolve(blockInfo.time as string);
          }
        );
      }
    );
  });
};

export const getBlockHashByHeight = async (
  height: string | number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(
      `bitcoin-cli ${network} getblockhash ${height}`, //TODO: change to RPC
      (error, stdout, stderr) => {
        if (error) {
          console.log(`error: ${error.message}`);
          reject(error.message);
        }
        if (stderr) {
          console.log(`stderr: ${stderr}`);
          reject(stderr);
        }
        resolve(stdout.trim());
      }
    );
  });
};

const getWitnessData = async (txId: string) => {
  return new Promise((resolve, reject) => {
    exec(
      `bitcoin-cli ${network} getrawtransaction ${txId}`, //TODO: change to RPC
      (error, stdout, stderr) => {
        if (error) {
          console.log(`error: ${error.message}`);
          reject(error.message);
        }
        if (stderr) {
          console.log(`stderr: ${stderr}`);
          reject(stderr);
        }
        const txRaw = String(stdout.trim());
        const tx = Tx.decode(txRaw);
        const witness = tx.vin[0].witness[1];
        resolve(witness);
      }
    );
  });
};

const readRawData = (witness: ScriptData) => {
  if (witness) {
    raw = Buffer.from(witness as string, 'hex');
  } else {
    console.error('Please provide a tx_file or set witness_data.');
    process.exit(1);
  }
};

const readBytes = (n = 1) => {
  const value = raw.slice(pointer, pointer + n);
  pointer += n;
  return value;
};

const getInitialPosition = () => {
  const inscription_mark = Buffer.from('0063036f7264', 'hex'); //TODO: support more envelope types
  const position = raw.indexOf(inscription_mark);
  if (position === -1) {
    console.error('No ordinal inscription found in transaction');
    process.exit(1);
  }
  return position + inscription_mark.length;
};

const readContentType = () => {
  const OP_1 = Buffer.from('51', 'hex');
  const byte = readBytes();
  if (!byte.equals(OP_1)) {
    if (
      !byte.equals(Buffer.from('01', 'hex')) ||
      !readBytes().equals(Buffer.from('01', 'hex'))
    ) {
      throw new Error('Invalid content type');
    }
  }
  const size = readBytes().readUIntBE(0, 1);
  const contentType = readBytes(size);
  return contentType.toString('utf8');
};

const readPushData = (opcode: any) => {
  const int_opcode = opcode.readUIntBE(0, 1);

  if (0x01 <= int_opcode && int_opcode <= 0x4b) {
    return readBytes(int_opcode);
  }

  let num_bytes = 0;
  if (int_opcode === 0x4c) {
    num_bytes = 1;
  } else if (int_opcode === 0x4d) {
    num_bytes = 2;
  } else if (int_opcode === 0x4e) {
    num_bytes = 4;
  } else {
    console.error(
      `Invalid push opcode ${int_opcode.toString(16)} at position ${pointer}`
    );
    process.exit(1);
  }

  const size = readBytes(num_bytes).readUIntLE(0, num_bytes);
  return readBytes(size);
};

export const getContent = async (txId: any) => {
  const witness = await getWitnessData(txId);
  if (!witness) {
    throw new Error('No witness data found');
  }
  if (typeof witness !== 'string') {
    throw new Error('Witness data is not a string');
  }
  readRawData(witness);
  pointer = getInitialPosition();

  const contentType = readContentType();
  console.log(`Content type: ${contentType}`);
  if (!readBytes().equals(Buffer.from('00', 'hex'))) {
    throw new Error('Invalid data format');
  }

  const data = [];

  const OP_ENDIF = Buffer.from('68', 'hex');
  let opcode = readBytes();
  while (!opcode.equals(OP_ENDIF)) {
    const chunk = readPushData(opcode);
    data.push(chunk);
    opcode = readBytes();
  }

  console.log(`Total size: ${Buffer.concat(data).length} bytes`);
  return { data, contentType };
};
