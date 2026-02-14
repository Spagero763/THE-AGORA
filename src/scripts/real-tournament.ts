/**
 * Run a real MON tournament on Monad testnet
 */

import 'dotenv/config';
import { initializeDatabase, getDatabase } from '../database/db.js';
import { initializeAI } from '../ai/groq-service.js';
import { createArena, joinArena, runFullTournament, getArenaById } from '../arena/arena-manager.js';
import { checkBalance } from '../blockchain/transactions.js';
import { formatEther } from 'viem';

async function runRealTournament() {
  initializeDatabase();
  initializeAI();

  console.log('═══════════════════════════════════════════');
  console.log('🏆 REAL MON TOURNAMENT');
  console.log('═══════════════════════════════════════════\n');

  // Get all agents
  const db = getDatabase();
  const agents = db.prepare('SELECT id, name, wallet_address FROM agents LIMIT 4').all() as Array<{
    id: string;
    name: string;
    wallet_address: string;
  }>;

  if (agents.length < 2) {
    console.log('❌ Need at least 2 agents. Run demo first: npm run demo');
    return;
  }

  // Check agent balances
  console.log('📊 Agent Balances:\n');
  for (const agent of agents) {
    const balance = await checkBalance(agent.wallet_address as `0x${string}`);
    console.log(`   ${agent.name}: ${balance} MON`);
  }

  // Create arena with entry fee
  const entryFee = '0.01'; // 0.01 MON per agent
  console.log(`\n🏟️  Creating arena with ${entryFee} MON entry fee...\n`);
  
  const arena = createArena({
    name: 'Real MON Championship',
    gameType: 'rock_paper_scissors',
    entryFeeInMON: entryFee,
    maxParticipants: 4,
  });

  // Join with REAL MON payments
  console.log('🎟️  Agents joining with real MON payments...\n');
  
  for (const agent of agents) {
    const result = await joinArena(arena.id, agent.id, true); // useRealMON = true
    if (!result) {
      console.log(`   ❌ ${agent.name} failed to join`);
    }
  }

  // Check prize pool
  const arenaData = getArenaById(arena.id);
  const prizePool = formatEther(BigInt(arenaData?.prize_pool || '0'));
  console.log(`\n💰 Prize Pool: ${prizePool} MON\n`);

  // Run tournament with REAL payouts
  console.log('🎮 Starting tournament with real MON payouts...\n');
  
  const result = await runFullTournament(arena.id, true); // useRealMON = true

  if (result?.winner) {
    const winner = result.winner;
    console.log(`\n🎉 WINNER: ${winner.name}`);
    console.log(`💸 Prize of ${prizePool} MON sent to ${winner.wallet_address.slice(0, 15)}...`);
    
    // Check winner's new balance
    const newBalance = await checkBalance(winner.wallet_address as `0x${string}`);
    console.log(`💰 Winner's new balance: ${newBalance} MON`);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('✅ Tournament complete with real transactions!');
  console.log('═══════════════════════════════════════════');
}

runRealTournament().catch(console.error);
