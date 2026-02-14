import 'dotenv/config';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, formatEther } from 'viem';
import { getMonadChain, getNetworkConfig } from '../config/network.js';

const privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
  console.log('No PRIVATE_KEY in .env');
  process.exit(1);
}

const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
const account = privateKeyToAccount(formattedKey);
const chain = getMonadChain();
const config = getNetworkConfig();

const client = createPublicClient({
  chain,
  transport: http(config.rpcUrl),
});

console.log('='.repeat(50));
console.log('WALLET INFO');
console.log('='.repeat(50));
console.log('Address:', account.address);
console.log('Network:', chain.name);
console.log('Chain ID:', chain.id);

try {
  const balance = await client.getBalance({ address: account.address });
  console.log('Balance:', formatEther(balance), 'MON');
  
  if (balance === 0n) {
    console.log('\nWallet is empty! Request testnet MON:');
    console.log(`curl -X POST https://agents.devnads.com/v1/faucet -H "Content-Type: application/json" -d '{"address":"${account.address}"}'`);
  }
} catch (e) {
  console.log('Could not fetch balance:', e);
}
