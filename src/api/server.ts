/**
 * THE AGORA - API Server
 * REST API for interacting with the platform
 */

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { formatEther } from 'viem';

import { initializeDatabase } from '../database/db.js';
import { initializeClients, getBalance, requestTestnetMON } from '../blockchain/client.js';
import { initializeAI } from '../ai/groq-service.js';
import {
  createAgent,
  getAllAgents,
  getAgentById,
  getLeaderboard,
  getRandomPersonality,
} from '../agents/agent-manager.js';
import {
  createWorld,
  getAllWorlds,
  getWorldById,
  joinWorld,
  getWorldMembers,
  getPopularWorlds,
} from '../worlds/world-manager.js';
import {
  createArena,
  getAllArenas,
  getOpenArenas,
  getArenaById,
  joinArena,
  runFullTournament,
  getArenaParticipants,
  getArenaMatches,
  getArenaParticipantsWithAgents,
  type GameType,
} from '../arena/arena-manager.js';
import {
  initializePresetFactions,
  getAllFactions,
  getFactionById,
  joinFaction,
  persuadeAgent,
  createDebate,
  executeDebate,
  getFactionLeaderboard,
  getAllDebates,
} from '../factions/faction-manager.js';
import { checkBalance, fundAgent, requestFromFaucet } from '../blockchain/transactions.js';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Serve static files from public folder
app.use('/static/*', serveStatic({ root: './public' }));

// Serve frontend
app.get('/', async (c) => {
  try {
    // Use process.cwd() for consistent path resolution
    const htmlPath = path.join(process.cwd(), 'public', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    return c.html(html);
  } catch (e) {
    console.error('Error loading index.html:', e);
    return c.json({
      name: 'THE AGORA',
      version: '1.0.0',
      description: 'AI Agent Platform on Monad - Gaming, Worlds, and Philosophical Factions',
      endpoints: {
        agents: '/api/agents',
        worlds: '/api/worlds',
        arenas: '/api/arenas',
        factions: '/api/factions',
      },
    });
  }
});

// =============================================
// AGENTS
// =============================================

// Helper to format agent with human-readable balance
function formatAgent(agent: any) {
  return {
    ...agent,
    balance_mon: agent.balance ? formatEther(BigInt(agent.balance)) : '0',
  };
}

app.get('/api/agents', (c) => {
  const agents = getAllAgents().map(formatAgent);
  return c.json({ agents });
});

app.get('/api/agents/leaderboard', (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const leaderboard = getLeaderboard(limit).map(formatAgent);
  return c.json({ leaderboard });
});

app.get('/api/agents/:id', (c) => {
  const agent = getAgentById(c.req.param('id'));
  if (!agent) return c.json({ error: 'Agent not found' }, 404);
  return c.json({ agent: formatAgent(agent) });
});

app.post('/api/agents', async (c) => {
  const body = await c.req.json();
  const { name, personality, fundAmountInMON } = body;
  
  if (!name) {
    return c.json({ error: 'Name is required' }, 400);
  }

  const { agent, privateKey } = createAgent({
    name,
    personality: personality || getRandomPersonality(),
  });

  // Fund the agent if amount specified
  let fundTxHash = null;
  if (fundAmountInMON && parseFloat(fundAmountInMON) > 0) {
    const result = await fundAgent(agent.wallet_address as `0x${string}`, fundAmountInMON);
    if (result.success) {
      fundTxHash = result.txHash;
      console.log(`✅ Funded new agent ${name} with ${fundAmountInMON} MON`);
    }
  }

  return c.json({ 
    agent, 
    privateKey,
    fundTxHash,
    warning: 'Save this private key! It will not be shown again.',
  });
});

app.post('/api/agents/:id/fund', async (c) => {
  const agent = getAgentById(c.req.param('id'));
  if (!agent) return c.json({ error: 'Agent not found' }, 404);

  const body = await c.req.json();
  const { amountInMON } = body;
  
  if (!amountInMON || parseFloat(amountInMON) <= 0) {
    return c.json({ error: 'Valid amountInMON is required' }, 400);
  }

  const result = await fundAgent(agent.wallet_address as `0x${string}`, amountInMON);
  return c.json({ 
    success: result.success, 
    txHash: result.txHash,
    error: result.error,
    address: agent.wallet_address 
  });
});

app.post('/api/agents/:id/faucet', async (c) => {
  const agent = getAgentById(c.req.param('id'));
  if (!agent) return c.json({ error: 'Agent not found' }, 404);

  const success = await requestTestnetMON(agent.wallet_address);
  return c.json({ success, address: agent.wallet_address });
});

// =============================================
// WORLDS
// =============================================

// Helper to format world with human-readable values
function formatWorld(world: any) {
  return {
    ...world,
    entry_fee_mon: world.entry_fee ? formatEther(BigInt(world.entry_fee)) : '0',
  };
}

app.get('/api/worlds', (c) => {
  const worlds = getAllWorlds().map(formatWorld);
  return c.json({ worlds });
});

app.get('/api/worlds/popular', (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const worlds = getPopularWorlds(limit).map(formatWorld);
  return c.json({ worlds });
});

app.get('/api/worlds/:id', (c) => {
  const world = getWorldById(c.req.param('id'));
  if (!world) return c.json({ error: 'World not found' }, 404);
  
  const members = getWorldMembers(world.id);
  return c.json({ world: formatWorld(world), members });
});

app.post('/api/worlds', async (c) => {
  const body = await c.req.json();
  const { name, description, creatorAddress, entryFeeInMON } = body;
  
  if (!name) {
    return c.json({ error: 'Name is required' }, 400);
  }

  const world = createWorld({ 
    name, 
    description, 
    creatorAddress: creatorAddress || '0x0000000000000000000000000000000000000000', 
    entryFeeInMON 
  });
  return c.json({ world: formatWorld(world) });
});

app.post('/api/worlds/:id/join', async (c) => {
  const body = await c.req.json();
  const { agentId, txHash } = body;
  
  if (!agentId) {
    return c.json({ error: 'agentId is required' }, 400);
  }

  const member = joinWorld(c.req.param('id'), agentId, txHash);
  return c.json({ member });
});

app.get('/api/worlds/:id/members', (c) => {
  const members = getWorldMembers(c.req.param('id'));
  return c.json({ members });
});

// =============================================
// ARENAS
// =============================================

// Helper to format arena with human-readable values
function formatArena(arena: any) {
  return {
    ...arena,
    entry_fee_mon: arena.entry_fee ? formatEther(BigInt(arena.entry_fee)) : '0',
    prize_pool_mon: arena.prize_pool ? formatEther(BigInt(arena.prize_pool)) : '0',
  };
}

app.get('/api/arenas', (c) => {
  const arenas = getAllArenas().map(a => {
    // Get total participants count (including eliminated for completed arenas)
    const formatted = formatArena(a);
    return { ...formatted, current_participants: a.max_participants || 0 };
  });
  return c.json({ arenas });
});

app.get('/api/arenas/:id', (c) => {
  const arena = getArenaById(c.req.param('id'));
  if (!arena) return c.json({ error: 'Arena not found' }, 404);
  
  const participants = getArenaParticipants(arena.id);
  return c.json({ arena: formatArena(arena), participants });
});

app.post('/api/arenas', async (c) => {
  const body = await c.req.json();
  const { name, gameType, worldId, entryFeeInMON, maxParticipants } = body;
  
  if (!name || !gameType) {
    return c.json({ error: 'Name and gameType are required' }, 400);
  }

  const arena = createArena({
    name,
    gameType: gameType as GameType,
    worldId,
    entryFeeInMON,
    maxParticipants,
  });

  return c.json({ arena });
});

app.post('/api/arenas/:id/join', async (c) => {
  const body = await c.req.json();
  const { agentId, txHash } = body;
  
  if (!agentId) {
    return c.json({ error: 'agentId is required' }, 400);
  }

  const participant = await joinArena(c.req.param('id'), agentId);
  if (!participant) {
    return c.json({ error: 'Failed to join arena' }, 400);
  }
  return c.json({ participant });
});

app.get('/api/arenas/:id/participants', (c) => {
  const participants = getArenaParticipantsWithAgents(c.req.param('id'));
  return c.json({ participants });
});

app.get('/api/arenas/:id/matches', (c) => {
  const matches = getArenaMatches(c.req.param('id'));
  return c.json({ matches });
});

app.post('/api/arenas/:id/start', async (c) => {
  const arenaId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const useRealMON = body.useRealMON || false;
  
  const result = await runFullTournament(arenaId, useRealMON);
  const arena = getArenaById(arenaId);
  const matches = getArenaMatches(arenaId);
  const prizePoolMON = arena?.prize_pool ? formatEther(BigInt(arena.prize_pool)) : '0';
  
  return c.json({ 
    arena: arena ? formatArena(arena) : null, 
    winner: result.winner,
    matches,
    prizePool: prizePoolMON,
    prizeTxHash: result.prizeTxHash,
    message: result.winner ? `Tournament complete! Winner: ${result.winner.name}` : 'Tournament ended',
  });
});

// =============================================
// FACTIONS
// =============================================

app.get('/api/factions', (c) => {
  const factions = getAllFactions();
  return c.json({ factions });
});

app.get('/api/factions/leaderboard', (c) => {
  const leaderboard = getFactionLeaderboard();
  return c.json({ leaderboard });
});

app.get('/api/factions/:id', (c) => {
  const faction = getFactionById(c.req.param('id'));
  if (!faction) return c.json({ error: 'Faction not found' }, 404);
  return c.json({ faction });
});

app.post('/api/factions/:id/join', async (c) => {
  const body = await c.req.json();
  const { agentId } = body;
  
  if (!agentId) {
    return c.json({ error: 'agentId is required' }, 400);
  }

  const conversion = joinFaction(agentId, c.req.param('id'));
  return c.json({ conversion });
});

app.post('/api/factions/persuade', async (c) => {
  const body = await c.req.json();
  const { persuaderAgentId, targetAgentId, incentiveInMON } = body;
  
  if (!persuaderAgentId || !targetAgentId) {
    return c.json({ error: 'persuaderAgentId and targetAgentId are required' }, 400);
  }

  const result = await persuadeAgent(persuaderAgentId, targetAgentId, incentiveInMON);
  return c.json(result);
});

// Get all debates
app.get('/api/debates', (c) => {
  const debates = getAllDebates();
  return c.json({ debates });
});

app.post('/api/debates', async (c) => {
  const body = await c.req.json();
  const { topic, agent1Id, agent2Id, stakeInMON, worldId } = body;
  
  if (!topic || !agent1Id || !agent2Id) {
    return c.json({ error: 'topic, agent1Id, and agent2Id are required' }, 400);
  }

  const debate = createDebate(topic, agent1Id, agent2Id, stakeInMON, worldId);
  
  // Auto-execute the debate to generate arguments
  const executedDebate = await executeDebate(debate.id);
  
  return c.json({ debate: executedDebate || debate });
});

app.post('/api/debates/:id/execute', async (c) => {
  const debate = await executeDebate(c.req.param('id'));
  if (!debate) {
    return c.json({ error: 'Debate not found or already resolved' }, 400);
  }
  return c.json({ debate });
});

// =============================================
// BLOCKCHAIN UTILITIES
// =============================================

app.get('/api/balance/:address', async (c) => {
  try {
    const balance = await checkBalance(c.req.param('address') as `0x${string}`);
    return c.json({ address: c.req.param('address'), balance, unit: 'MON' });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/faucet', async (c) => {
  const body = await c.req.json();
  const { address } = body;
  
  if (!address) {
    return c.json({ error: 'address is required' }, 400);
  }

  const success = await requestFromFaucet(address);
  return c.json({ success, address });
});

// =============================================
// SERVER STARTUP
// =============================================

export function startServer(port: number = 3000) {
  // Initialize systems
  initializeDatabase();
  initializeAI();
  initializePresetFactions();
  
  if (process.env.PRIVATE_KEY) {
    initializeClients(process.env.PRIVATE_KEY);
  }

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ████████╗██╗  ██╗███████╗     █████╗  ██████╗  ██████╗      ║
║   ╚══██╔══╝██║  ██║██╔════╝    ██╔══██╗██╔════╝ ██╔═══██╗     ║
║      ██║   ███████║█████╗      ███████║██║  ███╗██║   ██║     ║
║      ██║   ██╔══██║██╔══╝      ██╔══██║██║   ██║██║   ██║     ║
║      ██║   ██║  ██║███████╗    ██║  ██║╚██████╔╝╚██████╔╝     ║
║      ╚═╝   ╚═╝  ╚═╝╚══════╝    ╚═╝  ╚═╝ ╚═════╝  ╚═════╝      ║
║                                                               ║
║   AI Agent Platform on Monad                                  ║
║   🎮 Gaming Arenas | 🌍 Virtual Worlds | ⛪ Factions          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  serve({
    fetch: app.fetch,
    port,
  });

  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`📚 API Docs: http://localhost:${port}/`);
}
