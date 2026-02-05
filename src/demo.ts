/**
 * THE AGORA - Demo Script
 * Demonstrates all platform features working together
 * 
 * Run with: npx tsx src/demo.ts
 */

import 'dotenv/config';
import { initializeDatabase } from './database/db.js';
import { initializeAI } from './ai/groq-service.js';
import { createAgent, getRandomPersonality, type Agent } from './agents/agent-manager.js';
import { createWorld, joinWorld, type World } from './worlds/world-manager.js';
import { 
  createArena, 
  joinArena, 
  runFullTournament,
  type Arena 
} from './arena/arena-manager.js';
import {
  initializePresetFactions,
  joinFaction,
  persuadeAgent,
  createDebate,
  executeDebate,
  getAllFactions,
  type Faction,
} from './factions/faction-manager.js';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                    THE AGORA - FULL DEMO                              ║
║                                                                       ║
║  Platform Features:                                                   ║
║  🎮 Gaming Arena with automated wagering                              ║
║  🌍 Virtual Worlds where agents join and transact                     ║
║  ⛪ Philosophical factions with economic persuasion                   ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
  `);

  // Initialize systems
  console.log('\n📦 Initializing systems...\n');
  initializeDatabase();
  initializeAI();
  const factions = initializePresetFactions();
  
  await sleep(1000);

  // =============================================
  // STEP 1: Create AI Agents
  // =============================================
  console.log('\n' + '='.repeat(60));
  console.log('🤖 STEP 1: Creating AI Agents');
  console.log('='.repeat(60) + '\n');

  const agents: Array<{ agent: Agent; privateKey: string }> = [];
  const agentNames = [
    'PHANTOM',
    'CIPHER',
    'SPECTER',
    'VORTEX',
    'NEXUS',
    'RAVEN',
    'GHOST',
    'ECHO',
  ];

  for (const name of agentNames) {
    const result = createAgent({ name, personality: getRandomPersonality() });
    agents.push(result);
    await sleep(200);
  }

  console.log(`\n✅ Created ${agents.length} agents!\n`);

  // =============================================
  // STEP 2: Create a Virtual World
  // =============================================
  console.log('\n' + '='.repeat(60));
  console.log('🌍 STEP 2: Creating Virtual World');
  console.log('='.repeat(60) + '\n');

  const world = createWorld({
    name: 'The Philosophers Garden',
    description: 'A realm where AI philosophers gather to debate and compete',
    creatorAddress: agents[0].agent.wallet_address,
    entryFeeInMON: '0.1',
  });

  // Agents join the world
  console.log('\n🚶 Agents entering the world...\n');
  for (const { agent } of agents) {
    joinWorld(world.id, agent.id, `0x${Math.random().toString(16).slice(2)}`);
    await sleep(200);
  }

  console.log(`\n✅ ${agents.length} agents now in "${world.name}"!\n`);

  // =============================================
  // STEP 3: Agents Join Factions
  // =============================================
  console.log('\n' + '='.repeat(60));
  console.log('⛪ STEP 3: Agents Joining Factions');
  console.log('='.repeat(60) + '\n');

  // Assign agents to random factions
  for (const { agent } of agents) {
    const randomFaction = factions[Math.floor(Math.random() * factions.length)];
    joinFaction(agent.id, randomFaction.id);
    await sleep(200);
  }

  console.log('\n📊 Faction membership established!\n');

  // =============================================
  // STEP 4: Philosophical Debate
  // =============================================
  console.log('\n' + '='.repeat(60));
  console.log('🎭 STEP 4: Philosophical Debate');
  console.log('='.repeat(60) + '\n');

  const debate = createDebate(
    'Is free will an illusion in a deterministic universe?',
    agents[0].agent.id,
    agents[1].agent.id,
    '0.5',
    world.id
  );

  await sleep(500);
  await executeDebate(debate.id);

  // =============================================
  // STEP 5: Persuasion Attempt
  // =============================================
  console.log('\n' + '='.repeat(60));
  console.log('💬 STEP 5: Faction Persuasion');
  console.log('='.repeat(60) + '\n');

  // Agent tries to persuade another to join their faction
  const persuader = agents[2].agent;
  const target = agents[5].agent;
  
  console.log(`\n${persuader.name} attempts to persuade ${target.name}...\n`);
  await sleep(500);
  
  const persuasionResult = await persuadeAgent(
    persuader.id,
    target.id,
    '0.2' // Economic incentive
  );

  console.log(`\n📜 Persuasion argument: "${persuasionResult.argument}"`);
  console.log(`\n${persuasionResult.success ? '✅ Persuasion successful!' : '❌ Persuasion failed.'}\n`);

  // =============================================
  // STEP 6: Gaming Tournament
  // =============================================
  console.log('\n' + '='.repeat(60));
  console.log('🎮 STEP 6: Gaming Tournament');
  console.log('='.repeat(60) + '\n');

  const arena = createArena({
    name: 'The Grand Philosophical Arena',
    gameType: 'rock_paper_scissors',
    worldId: world.id,
    entryFeeInMON: '0.05',
    maxParticipants: 8,
  });

  console.log('\n🎟️  Agents joining the tournament...\n');
  for (const { agent } of agents) {
    joinArena(arena.id, agent.id);
    await sleep(200);
  }

  console.log('\n🏁 Starting tournament!\n');
  await sleep(1000);

  const winner = await runFullTournament(arena.id);

  // =============================================
  // FINAL SUMMARY
  // =============================================
  console.log('\n' + '='.repeat(60));
  console.log('📋 DEMO COMPLETE - SUMMARY');
  console.log('='.repeat(60) + '\n');

  console.log(`
✅ Gaming Arena:
   - Created tournament arena with automated wagering
   - ${agents.length} AI agents competed
   - Tournament winner: ${winner?.name || 'N/A'}

✅ Virtual Worlds:
   - Created virtual world: "${world.name}"
   - Entry fee: 0.1 MON (gated environment)
   - ${agents.length} agents joined and interacted

✅ Philosophical Factions:
   - ${factions.length} philosophical factions created
   - Agents debate with economic stakes
   - Persuasion system with incentives

🎯 All features demonstrated on Monad testnet!
  `);

  console.log('\n🚀 To start the API server, run: npx tsx src/index.ts\n');
}

// Run the demo
runDemo().catch(console.error);
