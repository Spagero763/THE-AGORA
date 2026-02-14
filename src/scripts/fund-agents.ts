/**
 * Fund all agents with MON from platform wallet
 */

import 'dotenv/config';
import { initializeDatabase, getDatabase } from '../database/db.js';
import { fundAgent, checkBalance } from '../blockchain/transactions.js';
import { privateKeyToAccount } from 'viem/accounts';

const AMOUNT_PER_AGENT = '0.0008'; // MON to send each agent

async function fundAllAgents() {
  initializeDatabase();
  
  const platformKey = process.env.PRIVATE_KEY;
  if (!platformKey) {
    console.log('❌ No PRIVATE_KEY in .env');
    return;
  }

  const formattedKey = (platformKey.startsWith('0x') ? platformKey : `0x${platformKey}`) as `0x${string}`;
  const platformAccount = privateKeyToAccount(formattedKey);

  console.log('═══════════════════════════════════════════');
  console.log('💰 FUNDING ALL AGENTS');
  console.log('═══════════════════════════════════════════');
  console.log('Platform wallet:', platformAccount.address);
  
  const platformBalance = await checkBalance(platformAccount.address);
  console.log('Platform balance:', platformBalance, 'MON');
  console.log('Amount per agent:', AMOUNT_PER_AGENT, 'MON');
  console.log('═══════════════════════════════════════════\n');

  // Get all agents
  const db = getDatabase();
  const agents = db.prepare('SELECT id, name, wallet_address FROM agents').all() as Array<{
    id: string;
    name: string;
    wallet_address: string;
  }>;

  if (agents.length === 0) {
    console.log('No agents found. Run demo first: npm run demo');
    return;
  }

  console.log(`Found ${agents.length} agents to fund\n`);

  let funded = 0;
  let failed = 0;

  for (const agent of agents) {
    console.log(`💸 Funding ${agent.name}...`);
    
    const result = await fundAgent(agent.wallet_address as `0x${string}`, AMOUNT_PER_AGENT);
    
    if (result.success) {
      funded++;
      console.log(`   ✅ Sent ${AMOUNT_PER_AGENT} MON (tx: ${result.txHash?.slice(0, 15)}...)`);
    } else {
      failed++;
      console.log(`   ❌ Failed: ${result.error}`);
      
      // If we run out of funds, stop
      if (result.error?.includes('Insufficient balance')) {
        console.log('\n⚠️ Platform wallet out of funds. Stopping.');
        break;
      }
    }
    
    // Small delay between transactions
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════');
  console.log(`✅ Funded: ${funded} agents`);
  console.log(`❌ Failed: ${failed} agents`);
  
  const newBalance = await checkBalance(platformAccount.address);
  console.log(`💰 Platform balance remaining: ${newBalance} MON`);
  console.log('═══════════════════════════════════════════');
}

fundAllAgents().catch(console.error);
