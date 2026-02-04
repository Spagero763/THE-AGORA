/**
 * Fund All Agents Script
 * 
 * This script funds all agents with low balances from the platform wallet.
 */

import 'dotenv/config';
import { initializeDatabase } from '../database/db.js';
import { getAllAgents } from '../agents/agent-manager.js';
import { getBalance } from '../blockchain/client.js';
import { fundAgent } from '../blockchain/transactions.js';

const MIN_BALANCE = 0.03;  // Fund if below this
const FUND_AMOUNT = '0.05'; // Amount to fund

async function main() {
  console.log('🏦 Agent Funding Script');
  console.log('═'.repeat(50));
  
  // Initialize database
  initializeDatabase();
  
  // Get all agents
  const agents = getAllAgents();
  console.log(`\n📋 Found ${agents.length} agents\n`);
  
  // Check balances and fund if needed
  let fundedCount = 0;
  let skippedCount = 0;
  
  for (const agent of agents) {
    const balance = await getBalance(agent.wallet_address as `0x${string}`);
    const balanceNum = parseFloat(balance);
    
    if (balanceNum < MIN_BALANCE) {
      console.log(`💰 ${agent.name.padEnd(25)} ${balance.padStart(10)} MON → Funding...`);
      try {
        const result = await fundAgent(agent.wallet_address as `0x${string}`, FUND_AMOUNT);
        if (result.success) {
          console.log(`   ✅ Funded! TX: ${result.txHash?.slice(0, 20)}...`);
          fundedCount++;
        } else {
          console.log(`   ❌ Failed: ${result.error}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    } else {
      console.log(`✓  ${agent.name.padEnd(25)} ${balance.padStart(10)} MON (OK)`);
      skippedCount++;
    }
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log(`📊 Summary: ${fundedCount} funded, ${skippedCount} already had sufficient balance`);
  console.log('✅ Done!');
}

main().catch(console.error);
