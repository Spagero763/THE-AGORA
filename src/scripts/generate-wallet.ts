/**
 * Generate a new wallet for an agent
 * Run with: npx tsx src/scripts/generate-wallet.ts
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  NEW WALLET GENERATED                         ║
╚═══════════════════════════════════════════════════════════════╝

📍 Address:     ${account.address}
🔑 Private Key: ${privateKey}

⚠️  IMPORTANT: Save the private key securely!
    Add it to your .env file as: PRIVATE_KEY=${privateKey.slice(2)}

💧 To get testnet MON, use the faucet:
   POST https://agents.devnads.com/v1/faucet
   Body: { "address": "${account.address}" }
`);
