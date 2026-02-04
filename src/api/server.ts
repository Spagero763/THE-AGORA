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
      name: 'The Agora',
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

app.get('/api/agents', (c) => {
  const agents = getAllAgents();
  return c.json({ agents });
});

app.get('/api/agents/leaderboard', (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const leaderboard = getLeaderboard(limit);
  return c.json({ leaderboard });
});

app.get('/api/agents/:id', (c) => {
  const agent = getAgentById(c.req.param('id'));
  if (!agent) return c.json({ error: 'Agent not found' }, 404);
  return c.json({ agent });
});

app.post('/api/agents', async (c) => {
  const body = await c.req.json();
  const { name, personality } = body;
  
  if (!name) {
    return c.json({ error: 'Name is required' }, 400);
  }

  const { agent, privateKey } = createAgent({
    name,
    personality: personality || getRandomPersonality(),
  });

  return c.json({ 
    agent, 
    privateKey,
    warning: 'Save this private key! It will not be shown again.',
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

app.get('/api/worlds', (c) => {
  const worlds = getAllWorlds();
  return c.json({ worlds });
});

app.get('/api/worlds/popular', (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const worlds = getPopularWorlds(limit);
  return c.json({ worlds });
});

app.get('/api/worlds/:id', (c) => {
  const world = getWorldById(c.req.param('id'));
  if (!world) return c.json({ error: 'World not found' }, 404);
  
  const members = getWorldMembers(world.id);
  return c.json({ world, members });
});

app.post('/api/worlds', async (c) => {
  const body = await c.req.json();
  const { name, description, creatorAddress, entryFeeInMON } = body;
  
  if (!name || !creatorAddress) {
    return c.json({ error: 'Name and creatorAddress are required' }, 400);
  }

  const world = createWorld({ name, description, creatorAddress, entryFeeInMON });
  return c.json({ world });
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

// =============================================
// ARENAS
// =============================================

app.get('/api/arenas', (c) => {
  const arenas = getOpenArenas();
  return c.json({ arenas });
});

app.get('/api/arenas/:id', (c) => {
  const arena = getArenaById(c.req.param('id'));
  if (!arena) return c.json({ error: 'Arena not found' }, 404);
  
  const participants = getArenaParticipants(arena.id);
  return c.json({ arena, participants });
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
  const winner = await runFullTournament(arenaId);
  const arena = getArenaById(arenaId);
  
  return c.json({ 
    arena, 
    winner,
    message: winner ? `Tournament complete! Winner: ${winner.name}` : 'Tournament ended',
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

app.post('/api/debates', async (c) => {
  const body = await c.req.json();
  const { topic, agent1Id, agent2Id, stakeInMON, worldId } = body;
  
  if (!topic || !agent1Id || !agent2Id) {
    return c.json({ error: 'topic, agent1Id, and agent2Id are required' }, 400);
  }

  const debate = createDebate(topic, agent1Id, agent2Id, stakeInMON, worldId);
  return c.json({ debate });
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
