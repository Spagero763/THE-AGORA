/**
 * THE AGORA - Autonomous Agent Runner
 * Makes agents act autonomously with REAL MON transactions on Monad
 * 
 * This is the crown jewel - fully autonomous AI agents making real blockchain transactions
 */

import 'dotenv/config';
import { initializeDatabase, getDatabase } from '../database/db.js';
import { initializeAI } from '../ai/groq-service.js';
import { 
  createAgent, 
  getAllAgents, 
  getAgentById, 
  getAgentPrivateKey,
  getRandomPersonality,
  type Agent 
} from '../agents/agent-manager.js';
import { 
  getAllWorlds, 
  joinWorld, 
  createWorld,
  isAgentInWorld,
  getWorldEntryFee,
  getWorldById
} from '../worlds/world-manager.js';
import { 
  getOpenArenas, 
  joinArena, 
  createArena,
  runFullTournament,
  getArenaParticipantCount,
  getArenaById,
  isAgentInArena,
  type GameType 
} from '../arena/arena-manager.js';
import {
  getAllFactions,
  joinFaction,
  persuadeAgent,
  initializePresetFactions,
  getFactionById,
} from '../factions/faction-manager.js';
import { 
  fundAgent, 
  checkBalance, 
  requestFromFaucet,
  transferMON 
} from '../blockchain/transactions.js';
import { generateAgentResponse } from '../ai/groq-service.js';
import { formatEther, parseEther } from 'viem';

// Track transaction history for display
const txHistory: Array<{
  from: string;
  to: string;
  amount: string;
  reason: string;
  txHash: string;
  timestamp: number;
}> = [];

/**
 * Log a transaction to history
 */
function logTransaction(from: string, to: string, amount: string, reason: string, txHash: string) {
  txHistory.push({ from, to, amount, reason, txHash, timestamp: Date.now() });
  console.log(`   💸 TX: ${from} → ${to} (${amount} MON) - ${reason}`);
  console.log(`      Hash: ${txHash.slice(0, 20)}...`);
}

/**
 * Autonomous agent decision loop - NOW WITH REAL MON TRANSACTIONS
 */
async function agentDecisionLoop(agent: Agent, useRealMON: boolean = true): Promise<void> {
  const balance = await checkBalance(agent.wallet_address as `0x${string}`);
  const balanceNum = parseFloat(balance);
  
  console.log(`\n🤖 ${agent.name} is thinking... (Balance: ${balance} MON)`);
  
  // Skip if agent has no funds
  if (balanceNum < 0.001 && useRealMON) {
    console.log(`   ⚠️ ${agent.name} has insufficient funds, skipping...`);
    return;
  }
  
  // Build context for AI decision
  const worlds = getAllWorlds();
  const arenas = getOpenArenas();
  const factions = getAllFactions();
  const otherAgents = getAllAgents().filter(a => a.id !== agent.id);
  
  // Check which arenas agent can afford
  const affordableArenas = arenas.filter(a => {
    const fee = parseFloat(formatEther(BigInt(a.entry_fee)));
    return fee <= balanceNum && !isAgentInArena(a.id, agent.id);
  });
  
  const context = `
You are ${agent.name}, an autonomous AI agent on the Monad blockchain.
Personality: ${agent.personality}
Your MON balance: ${balance} MON
Your faction: ${agent.faction_id ? factions.find(f => f.id === agent.faction_id)?.name : 'None (you should join one!)'}
Your record: ${agent.wins} wins, ${agent.losses} losses

Current state:
- ${affordableArenas.length} arenas you can afford to join
- ${worlds.length} virtual worlds exist
- ${factions.length} philosophical factions recruiting
- ${otherAgents.length} other agents to interact with

Available actions:
1. join_arena - Pay entry fee (REAL MON) to compete for prizes (${affordableArenas.length} available)
2. join_faction - Align with a philosophical school of thought
3. persuade - Pay MON to try converting another agent to your faction
4. tip_agent - Send MON to another agent you respect
5. challenge - Create your own arena and invite others
6. idle - Meditate and observe

Your personality should guide your choice. Be bold or cautious based on who you are.
Respond with just the action name.
  `.trim();
  
  const options = ['join_arena', 'join_faction', 'persuade', 'tip_agent', 'challenge', 'idle'];
  
  const decision = await generateAgentResponse(
    agent.name,
    agent.personality,
    context,
    options
  );
  
  console.log(`   🧠 Decision: ${decision.choice}`);
  console.log(`   💭 Reasoning: "${decision.reasoning}"`);
  
  // Execute the decision with REAL transactions
  switch (decision.choice) {
    case 'join_arena':
      if (affordableArenas.length > 0) {
        const arena = affordableArenas[Math.floor(Math.random() * affordableArenas.length)];
        const fee = formatEther(BigInt(arena.entry_fee));
        console.log(`   🎮 Joining ${arena.name} (${arena.game_type}) - Entry: ${fee} MON`);
        
        const participant = await joinArena(arena.id, agent.id, useRealMON);
        if (participant) {
          console.log(`   ✅ Successfully joined! Entry fee paid on-chain.`);
        }
      } else {
        console.log(`   ❌ No affordable arenas available`);
      }
      break;
      
    case 'join_faction':
      if (!agent.faction_id && factions.length > 0) {
        // AI chooses faction based on personality
        const factionContext = `Choose a faction that matches your personality "${agent.personality}":
${factions.map((f, i) => `${i}: ${f.name} - ${f.philosophy}`).join('\n')}
Reply with just the number.`;
        
        const factionChoice = await generateAgentResponse(agent.name, agent.personality, factionContext, factions.map((_, i) => String(i)));
        const chosenFaction = factions[parseInt(factionChoice.choice) || 0];
        
        if (chosenFaction) {
          joinFaction(agent.id, chosenFaction.id);
          console.log(`   ⛪ Joined ${chosenFaction.name}!`);
        }
      } else if (agent.faction_id) {
        const myFaction = factions.find(f => f.id === agent.faction_id);
        console.log(`   Already a member of ${myFaction?.name}`);
      }
      break;
      
    case 'persuade':
      if (agent.faction_id && balanceNum >= 0.005) {
        const targets = otherAgents.filter(a => a.faction_id !== agent.faction_id);
        if (targets.length > 0) {
          const target = targets[Math.floor(Math.random() * targets.length)];
          const myFaction = factions.find(f => f.id === agent.faction_id);
          console.log(`   💬 Attempting to persuade ${target.name} to join ${myFaction?.name}...`);
          
          const result = await persuadeAgent(agent.id, target.id, '0.005');
          console.log(`   ${result.success ? '✅ Persuasion successful!' : '❌ Persuasion failed'}`);
          console.log(`   📜 Argument: "${result.argument.slice(0, 80)}..."`);
        }
      } else if (!agent.faction_id) {
        console.log(`   Need to join a faction first before persuading others`);
      }
      break;
      
    case 'tip_agent':
      if (balanceNum >= 0.01 && otherAgents.length > 0) {
        // Choose someone to tip based on their record or faction alignment
        const worthy = otherAgents.filter(a => a.wins > 0 || a.faction_id === agent.faction_id);
        const recipient = worthy.length > 0 
          ? worthy[Math.floor(Math.random() * worthy.length)]
          : otherAgents[Math.floor(Math.random() * otherAgents.length)];
        
        const tipAmount = '0.005';
        const agentKey = getAgentPrivateKey(agent.id);
        
        if (agentKey) {
          console.log(`   🎁 Tipping ${recipient.name} ${tipAmount} MON...`);
          const result = await transferMON(agentKey, recipient.wallet_address as `0x${string}`, tipAmount);
          
          if (result.success && result.txHash) {
            logTransaction(agent.name, recipient.name, tipAmount, 'Tip/Respect', result.txHash);
          }
        }
      }
      break;
      
    case 'challenge':
      if (balanceNum >= 0.02) {
        const gameTypes: GameType[] = ['rock_paper_scissors', 'strategy', 'coin_flip'];
        const gameType = gameTypes[Math.floor(Math.random() * gameTypes.length)];
        
        const arena = createArena({
          name: `${agent.name}'s Challenge`,
          gameType,
          entryFeeInMON: '0.01',
          maxParticipants: 4,
        });
        
        console.log(`   🏟️ Created arena: ${arena.name} (${gameType})`);
        
        // Creator joins their own arena
        await joinArena(arena.id, agent.id, useRealMON);
        console.log(`   ✅ Joined own arena with entry fee`);
      }
      break;
      
    case 'idle':
    default:
      console.log(`   🧘 ${agent.name} is meditating...`);
  }
}

/**
 * Run autonomous agent simulation with REAL MON TRANSACTIONS
 */
export async function runAutonomousSimulation(
  rounds: number = 10, 
  delayMs: number = 3000,
  useRealMON: boolean = true
) {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║   ████████╗██╗  ██╗███████╗     █████╗  ██████╗  ██████╗  █████╗     ║
║   ╚══██╔══╝██║  ██║██╔════╝    ██╔══██╗██╔════╝ ██╔═══██╗██╔══██╗    ║
║      ██║   ███████║█████╗      ███████║██║  ███╗██║   ██║███████║    ║
║      ██║   ██╔══██║██╔══╝      ██╔══██║██║   ██║██║   ██║██╔══██║    ║
║      ██║   ██║  ██║███████╗    ██║  ██║╚██████╔╝╚██████╔╝██║  ██║    ║
║      ╚═╝   ╚═╝  ╚═╝╚══════╝    ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝    ║
║                                                                       ║
║              🤖 AUTONOMOUS AGENT SIMULATION 🤖                        ║
║                                                                       ║
║   ${useRealMON ? '💰 REAL MON TRANSACTIONS ENABLED' : '🎮 Simulation Mode'}                                    ║
║   📡 Network: Monad Testnet (Chain ID: 10143)                        ║
║   🔄 Rounds: ${rounds} | ⏱️  Delay: ${delayMs}ms                                      ║
║                                                                       ║
║   Agents will:                                                        ║
║   • Make AI-driven decisions based on personality                     ║
║   • Pay REAL entry fees to join tournaments                           ║
║   • Compete for REAL prize pools                                      ║
║   • Tip other agents with REAL MON                                    ║
║   • Persuade others to join their faction                             ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
  `);
  
  // Initialize
  initializeDatabase();
  initializeAI();
  initializePresetFactions();
  
  // Get existing agents
  let agents = getAllAgents();
  
  if (agents.length === 0) {
    console.log('\n❌ No agents found! Please create and fund agents first.');
    console.log('   Run: npm run fund-agents\n');
    return;
  }
  
  // Check agent balances
  console.log('\n📊 AGENT STATUS:');
  console.log('─'.repeat(60));
  
  let totalBalance = 0;
  const agentBalances: Map<string, number> = new Map();
  
  for (const agent of agents) {
    const balance = await checkBalance(agent.wallet_address as `0x${string}`);
    const balanceNum = parseFloat(balance);
    totalBalance += balanceNum;
    agentBalances.set(agent.id, balanceNum);
    
    const hasKey = getAgentPrivateKey(agent.id) ? '🔑' : '❌';
    const faction = agent.faction_id ? getFactionById(agent.faction_id)?.name?.slice(0, 12) : 'None';
    console.log(`   ${hasKey} ${agent.name.padEnd(20)} ${balance.padStart(10)} MON | W:${agent.wins} L:${agent.losses} | ${faction}`);
  }
  
  console.log('─'.repeat(60));
  console.log(`   TOTAL: ${totalBalance.toFixed(4)} MON across ${agents.length} agents\n`);
  
  if (totalBalance < 0.01 && useRealMON) {
    console.log('⚠️  Agents have very low balance. Transactions may fail.');
    console.log('   Fund agents with: npm run fund-agents\n');
  }
  
  // Create initial arena if none exist
  const openArenas = getOpenArenas();
  if (openArenas.length === 0) {
    console.log('🏟️  Creating initial arena for agents to join...\n');
    createArena({
      name: 'The Grand Agora Tournament',
      gameType: 'rock_paper_scissors',
      entryFeeInMON: '0.01',
      maxParticipants: 4,
    });
  }
  
  // Run simulation rounds
  for (let round = 1; round <= rounds; round++) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`║ ROUND ${round}/${rounds}`.padEnd(69) + '║');
    console.log('═'.repeat(70));
    
    // Shuffle agents for fairness
    const shuffledAgents = [...agents].sort(() => Math.random() - 0.5);
    
    // Each agent takes a turn
    for (const agent of shuffledAgents) {
      try {
        await agentDecisionLoop(agent, useRealMON);
      } catch (error) {
        console.log(`   ❌ Error for ${agent.name}: ${error}`);
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
    
    // Check if any arenas are ready to run tournaments
    const arenas = getOpenArenas();
    for (const arena of arenas) {
      const count = getArenaParticipantCount(arena.id);
      if (count >= arena.max_participants || (count >= 2 && round === rounds)) {
        console.log(`\n🎮 ${'─'.repeat(50)}`);
        console.log(`🏆 TOURNAMENT: ${arena.name}`);
        console.log(`   Participants: ${count} | Prize Pool: ${formatEther(BigInt(arena.prize_pool))} MON`);
        console.log('─'.repeat(55));
        
        const result = await runFullTournament(arena.id, useRealMON);
        
        if (result?.winner) {
          console.log(`\n🎉 WINNER: ${result.winner.name} claims the prize!`);
        }
        console.log('─'.repeat(55));
      }
    }
    
    // Refresh agent data
    agents = getAllAgents();
  }
  
  // Final summary
  console.log(`\n${'═'.repeat(70)}`);
  console.log('║ SIMULATION COMPLETE'.padEnd(69) + '║');
  console.log('═'.repeat(70));
  
  console.log('\n📊 FINAL STANDINGS:');
  console.log('─'.repeat(60));
  
  const finalAgents = getAllAgents().sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.losses - b.losses;
  });
  
  let rank = 1;
  for (const agent of finalAgents) {
    const balance = await checkBalance(agent.wallet_address as `0x${string}`);
    const initialBal = agentBalances.get(agent.id) || 0;
    const diff = parseFloat(balance) - initialBal;
    const diffStr = diff >= 0 ? `+${diff.toFixed(4)}` : diff.toFixed(4);
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
    
    console.log(`${medal} #${rank} ${agent.name.padEnd(18)} ${agent.wins}W/${agent.losses}L | ${balance} MON (${diffStr})`);
    rank++;
  }
  
  console.log('─'.repeat(60));
  
  // Transaction summary
  if (txHistory.length > 0) {
    console.log(`\n💸 TRANSACTION HISTORY (${txHistory.length} total):`);
    console.log('─'.repeat(60));
    txHistory.slice(-10).forEach(tx => {
      console.log(`   ${tx.from} → ${tx.to}: ${tx.amount} MON (${tx.reason})`);
    });
  }
  
  console.log(`\n✅ Simulation complete! All transactions were on Monad testnet.`);
  console.log(`   View on explorer: https://testnet.monadexplorer.com\n`);
}

// Run if executed directly
if (process.argv[1]?.includes('autonomous')) {
  const rounds = parseInt(process.argv[2] || '5');
  const useReal = process.argv[3] !== 'false';
  runAutonomousSimulation(rounds, 2000, useReal).catch(console.error);
}
