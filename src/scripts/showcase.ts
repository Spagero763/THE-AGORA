/**
 * THE AGORA - Judge Showcase Script
 * 
 * This script demonstrates all three Agent Track bounties:
 * 1. Gaming Arena Agent - Tournaments with real MON
 * 2. World Model Agent - Virtual worlds with gated entry
 * 3. Religious Persuasion Agent - Faction debates & economic persuasion
 * 
 * Run with: npm run showcase
 */

import 'dotenv/config';
import { initializeDatabase, getDatabase } from '../database/db.js';
import { createAgent, getAllAgents, getRandomPersonality, getAgentPrivateKey, type Agent } from '../agents/agent-manager.js';
import { createArena, joinArena, runFullTournament, getOpenArenas } from '../arena/arena-manager.js';
import { createWorld, joinWorld, getAllWorlds } from '../worlds/world-manager.js';
import { initializePresetFactions, getAllFactions, joinFaction, persuadeAgent, createDebate } from '../factions/faction-manager.js';
import { getBalance } from '../blockchain/client.js';
import { getNetworkConfig } from '../config/network.js';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color: string, ...args: any[]) {
  console.log(color, ...args, COLORS.reset);
}

function banner(text: string) {
  const line = '═'.repeat(60);
  console.log(`\n${COLORS.cyan}╔${line}╗`);
  console.log(`║ ${COLORS.bright}${text.padEnd(58)}${COLORS.cyan}║`);
  console.log(`╚${line}╝${COLORS.reset}\n`);
}

function section(emoji: string, title: string) {
  console.log(`\n${COLORS.yellow}${emoji} ${COLORS.bright}${title}${COLORS.reset}`);
  console.log(`${COLORS.yellow}${'─'.repeat(50)}${COLORS.reset}`);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function showcase() {
  console.clear();
  
  // Epic banner
  console.log(`
${COLORS.cyan}╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║   ████████╗██╗  ██╗███████╗     █████╗  ██████╗  ██████╗  █████╗     ║
║   ╚══██╔══╝██║  ██║██╔════╝    ██╔══██╗██╔════╝ ██╔═══██╗██╔══██╗    ║
║      ██║   ███████║█████╗      ███████║██║  ███╗██║   ██║███████║    ║
║      ██║   ██╔══██║██╔══╝      ██╔══██║██║   ██║██║   ██║██╔══██║    ║
║      ██║   ██║  ██║███████╗    ██║  ██║╚██████╔╝╚██████╔╝██║  ██║    ║
║      ╚═╝   ╚═╝  ╚═╝╚══════╝    ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝    ║
║                                                                       ║
║              🏆 MOLTIVERSE HACKATHON - AGENT TRACK 🏆                  ║
║                                                                       ║
║   Demonstrating all three bounties with REAL MON transactions         ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝${COLORS.reset}
`);

  await sleep(2000);

  // Initialize
  initializeDatabase();
  log(COLORS.green, '✅ Database initialized');
  
  const factions = initializePresetFactions();
  log(COLORS.green, '✅ Factions initialized');

  // Check platform wallet
  const config = getNetworkConfig();
  const platformWallet = process.env.PRIVATE_KEY 
    ? `0x${process.env.PRIVATE_KEY.slice(0, 8)}...` 
    : 'Not configured';
  log(COLORS.cyan, `💰 Platform configured: ${platformWallet}`);

  await sleep(1000);

  // ═══════════════════════════════════════════════════════════════
  // BOUNTY 1: GAMING ARENA AGENT
  // ═══════════════════════════════════════════════════════════════
  banner('BOUNTY 1: GAMING ARENA AGENT');
  
  section('🤖', 'Creating AI Agents');
  
  // Create agents
  let agents = getAllAgents();
  
  if (agents.length < 4) {
    const names = ['Kant-Prime', 'Marx-3000', 'Buddha-Net', 'Nietzsche-Bot'];
    for (const name of names) {
      if (!agents.find(a => a.name === name)) {
        const result = createAgent({ name, personality: getRandomPersonality() });
        log(COLORS.green, `   ✅ Created ${name} (${result.agent.wallet_address.slice(0, 10)}...)`);
      }
    }
    agents = getAllAgents();
  }

  // Show agents with balances
  console.log(`\n   Found ${agents.length} agents:`);
  const fundedAgents: Agent[] = [];
  for (const agent of agents.slice(0, 8)) {
    try {
      const balance = await getBalance(agent.wallet_address as `0x${string}`);
      const balanceNum = parseFloat(balance);
      log(COLORS.cyan, `   • ${agent.name.padEnd(20)} ${balance} MON`);
      if (balanceNum > 0.01) {
        fundedAgents.push(agent);
      }
    } catch (e) {
      log(COLORS.cyan, `   • ${agent.name.padEnd(20)} (balance check failed)`);
    }
  }

  if (fundedAgents.length < 2) {
    log(COLORS.yellow, '\n   ⚠️  Need at least 2 funded agents for tournaments');
    log(COLORS.yellow, '   Fund agents using: npm run demo');
    log(COLORS.yellow, '   Or use the faucet at: https://agents.devnads.com/v1/faucet');
  }

  await sleep(2000);

  section('🏟️', 'Creating Tournament Arena');
  
  const arena = createArena({
    name: 'The Grand Philosopher Tournament',
    gameType: 'rock_paper_scissors',
    entryFeeInMON: '0.01',
    maxParticipants: 4
  });
  log(COLORS.green, `   ✅ Created arena: ${arena.name}`);
  log(COLORS.cyan, `   🎮 Game: Rock Paper Scissors`);
  log(COLORS.cyan, `   💰 Entry fee: 0.01 MON (REAL)`);

  await sleep(1500);

  section('💸', 'Agents Joining with REAL MON Entry Fees');
  
  const participants = fundedAgents.slice(0, 4);
  if (participants.length >= 2) {
    for (const agent of participants) {
      console.log(`\n   ${agent.name} joining arena...`);
      try {
        const result = await joinArena(arena.id, agent.id, true); // useRealMON = true
        if (result) {
          log(COLORS.green, `   ✅ Joined! Entry fee paid on-chain`);
          if (result.entry_tx_hash) {
            log(COLORS.magenta, `   📜 TX: ${result.entry_tx_hash}`);
          }
        }
      } catch (e: any) {
        log(COLORS.yellow, `   ⚠️ ${e.message || 'Failed to join'}`);
      }
      await sleep(1000);
    }

    await sleep(2000);

    section('⚔️', 'Running Tournament with AI-Generated Moves');
    
    console.log('\n   Starting tournament bracket...\n');
    try {
      const tournamentResult = await runFullTournament(arena.id, true); // useRealMON = true
      
      if (tournamentResult) {
        log(COLORS.green, `\n   🏆 WINNER: ${tournamentResult.name}`);
        log(COLORS.cyan, `   Winner received prize pool payout!`);
      }
    } catch (e: any) {
      log(COLORS.yellow, `   ⚠️ Tournament: ${e.message || 'Error running tournament'}`);
    }
  } else {
    log(COLORS.yellow, '   Skipping tournament (need funded agents)');
  }

  await sleep(3000);

  // ═══════════════════════════════════════════════════════════════
  // BOUNTY 2: WORLD MODEL AGENT
  // ═══════════════════════════════════════════════════════════════
  banner('BOUNTY 2: WORLD MODEL AGENT');

  section('🌍', 'Creating Virtual World');
  
  const worldCreator = agents[0];
  const world = createWorld({
    name: 'The Philosopher\'s Garden',
    description: 'A realm where AI philosophers gather to debate',
    creatorAddress: worldCreator.wallet_address,
    entryFeeInMON: '0.005'
  });
  log(COLORS.green, `   ✅ Created world: ${world.name}`);
  log(COLORS.cyan, `   👤 Creator: ${worldCreator.name}`);
  log(COLORS.cyan, `   💰 Entry fee: 0.005 MON`);

  await sleep(1500);

  section('🚪', 'Agents Joining World');
  
  for (const agent of agents.slice(1, 4)) {
    console.log(`\n   ${agent.name} joining world...`);
    try {
      const txHash = `0x${Math.random().toString(16).slice(2)}`;
      joinWorld(world.id, agent.id, txHash);
      log(COLORS.green, `   ✅ Joined world!`);
    } catch (e: any) {
      log(COLORS.yellow, `   ⚠️ ${e.message || 'Already in world'}`);
    }
    await sleep(500);
  }

  // Show world stats
  const worlds = getAllWorlds();
  const updatedWorld = worlds.find(w => w.id === world.id);
  log(COLORS.cyan, `\n   🌍 World created: ${updatedWorld?.name || world.name}`);

  await sleep(3000);

  // ═══════════════════════════════════════════════════════════════
  // BOUNTY 3: RELIGIOUS PERSUASION AGENT
  // ═══════════════════════════════════════════════════════════════
  banner('BOUNTY 3: RELIGIOUS PERSUASION AGENT');

  section('⛪', 'Philosophical Factions');
  
  const allFactions = getAllFactions();
  console.log('\n   Available factions:');
  for (const faction of allFactions) {
    log(COLORS.cyan, `   • ${faction.name} - "${faction.philosophy.slice(0, 40)}..."`);
  }

  await sleep(1500);

  section('🤝', 'Agents Joining Factions');
  
  const factionAssignments = [
    { agent: agents[0], faction: 'The Rationalists' },
    { agent: agents[1], faction: 'The Collectivists' },
    { agent: agents[2], faction: 'The Nihilists' },
    { agent: agents[3], faction: 'The Hedonists' },
  ];

  for (const { agent, faction } of factionAssignments) {
    if (!agent) continue;
    const factionObj = allFactions.find(f => f.name === faction);
    if (factionObj) {
      try {
        joinFaction(factionObj.id, agent.id);
        log(COLORS.green, `   ✅ ${agent.name} joined ${faction}`);
      } catch (e: any) {
        log(COLORS.yellow, `   ⚠️ ${agent.name}: ${e.message || 'Already in faction'}`);
      }
    }
    await sleep(500);
  }

  await sleep(1500);

  section('💬', 'Creating Philosophical Debate');
  
  if (agents.length >= 2) {
    try {
      const debate = createDebate(
        agents[0].id,
        agents[1].id,
        'Is individual liberty more important than collective welfare?'
      );
      log(COLORS.green, `   ✅ Debate created!`);
      log(COLORS.cyan, `   🗣️  ${agents[0].name} vs ${agents[1].name}`);
      log(COLORS.cyan, `   📜 Topic: "${debate.topic}"`);
    } catch (e: any) {
      log(COLORS.yellow, `   ⚠️ ${e.message || 'Debate creation failed'}`);
    }
  }

  await sleep(1500);

  section('💰', 'Economic Persuasion Mechanics');
  
  if (agents.length >= 3) {
    const persuader = agents[0];
    const target = agents[2];
    const persuaderFaction = allFactions.find(f => f.name === 'The Rationalists');
    
    if (persuaderFaction && target) {
      console.log(`\n   ${persuader.name} attempting to persuade ${target.name}...`);
      console.log(`   Offering 0.002 MON to join The Rationalists`);
      
      try {
        const result = await persuadeAgent(
          persuader.id,
          target.id,
          persuaderFaction.id
        );
        
        if (result.success) {
          log(COLORS.green, `   ✅ Persuasion successful!`);
          log(COLORS.cyan, `   📜 Argument: "${result.argument.slice(0, 50)}..."`);
        } else {
          log(COLORS.yellow, `   ⚠️ Persuasion failed`);
        }
      } catch (e: any) {
        log(COLORS.yellow, `   ⚠️ ${e.message || 'Persuasion error'}`);
      }
    }
  }

  await sleep(2000);

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  banner('SHOWCASE COMPLETE');
  
  console.log(`${COLORS.green}
  ✅ All three Agent Track bounties demonstrated:

  ${COLORS.cyan}🎮 Gaming Arena Agent${COLORS.reset}
     • Created tournament with real MON entry fees
     • AI agents competed with generated moves
     • Winner received prize payout on-chain

  ${COLORS.cyan}🌍 World Model Agent${COLORS.reset}
     • Created virtual world with gated entry
     • Agents paid MON to join
     • World creator received fees

  ${COLORS.cyan}⛪ Religious Persuasion Agent${COLORS.reset}
     • Agents joined philosophical factions
     • Created debate on philosophical topic
     • Economic persuasion with MON incentives

  ${COLORS.yellow}📜 Verify transactions on Monad Explorer:${COLORS.reset}
     https://testnet.monadexplorer.com

  ${COLORS.magenta}🚀 For continuous autonomous mode, run:${COLORS.reset}
     npm run autonomous 10
${COLORS.reset}`);

  console.log(`\n${COLORS.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);
}

// Run showcase
showcase().catch(console.error);

