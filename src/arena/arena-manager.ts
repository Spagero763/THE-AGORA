/**
 * THE AGORA - Gaming Arena
 * Competitive gaming arenas with automated wagering and tournaments
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { parseEther, formatEther } from 'viem';
import { generateGameMove } from '../ai/groq-service.js';
import { getAgentById, getAgentPrivateKey, updateAgentStats, type Agent } from '../agents/agent-manager.js';
import { transferMON, checkBalance, fundAgent } from '../blockchain/transactions.js';

export interface Arena {
  id: string;
  name: string;
  game_type: string;
  world_id: string | null;
  entry_fee: string;
  prize_pool: string;
  max_participants: number;
  status: 'open' | 'in_progress' | 'completed';
  created_at: number;
  started_at: number | null;
  ended_at: number | null;
  winner_agent_id: string | null;
}

export interface ArenaParticipant {
  id: string;
  arena_id: string;
  agent_id: string;
  entry_tx_hash: string | null;
  joined_at: number;
  eliminated: number;
  final_position: number | null;
}

export interface Match {
  id: string;
  arena_id: string;
  round: number;
  agent1_id: string;
  agent2_id: string;
  agent1_choice: string | null;
  agent2_choice: string | null;
  winner_id: string | null;
  completed_at: number | null;
}

// Supported game types
export type GameType = 'rock_paper_scissors' | 'coin_flip' | 'number_guess' | 'strategy';

export const GAME_TYPES: Record<GameType, { name: string; moves: string[] }> = {
  rock_paper_scissors: {
    name: 'Rock Paper Scissors',
    moves: ['rock', 'paper', 'scissors'],
  },
  coin_flip: {
    name: 'Coin Flip',
    moves: ['heads', 'tails'],
  },
  number_guess: {
    name: 'Number Guess (1-10)',
    moves: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  },
  strategy: {
    name: 'Strategy (Attack/Defend/Counter)',
    moves: ['attack', 'defend', 'counter'],
  },
};

export interface CreateArenaParams {
  name: string;
  gameType: GameType;
  worldId?: string;
  entryFeeInMON?: string;
  maxParticipants?: number;
}

/**
 * Create a new gaming arena
 */
export function createArena(params: CreateArenaParams): Arena {
  const db = getDatabase();
  const id = uuidv4();
  const entryFee = params.entryFeeInMON 
    ? parseEther(params.entryFeeInMON).toString()
    : '0';

  const stmt = db.prepare(`
    INSERT INTO arenas (id, name, game_type, world_id, entry_fee, max_participants)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    params.name,
    params.gameType,
    params.worldId || null,
    entryFee,
    params.maxParticipants || 8
  );
  
  console.log(`🏟️  Created arena: ${params.name} (${GAME_TYPES[params.gameType].name})`);
  
  return getArenaById(id)!;
}

/**
 * Get arena by ID
 */
export function getArenaById(id: string): Arena | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM arenas WHERE id = ?');
  return stmt.get(id) as Arena | null;
}

/**
 * Get all arenas (any status)
 */
export function getAllArenas(): Arena[] {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM arenas ORDER BY created_at DESC");
  return stmt.all() as Arena[];
}

/**
 * Get all open arenas
 */
export function getOpenArenas(): Arena[] {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM arenas WHERE status = 'open' ORDER BY created_at DESC");
  return stmt.all() as Arena[];
}

/**
 * Join an arena (with optional real MON payment)
 */
export async function joinArena(arenaId: string, agentId: string, useRealMON: boolean = false): Promise<ArenaParticipant | null> {
  const db = getDatabase();
  const arena = getArenaById(arenaId);
  
  if (!arena || arena.status !== 'open') {
    console.log('❌ Arena not open for joining');
    return null;
  }

  const participantCount = getArenaParticipantCount(arenaId);
  if (participantCount >= arena.max_participants) {
    console.log('❌ Arena is full');
    return null;
  }

  const agent = getAgentById(agentId);
  if (!agent) {
    console.log('❌ Agent not found');
    return null;
  }

  let txHash: string | null = null;
  const entryFeeInMON = formatEther(BigInt(arena.entry_fee));
  
  // Execute real MON transfer if enabled and fee > 0
  if (useRealMON && parseFloat(entryFeeInMON) > 0) {
    const agentKey = getAgentPrivateKey(agentId);
    if (!agentKey) {
      console.log('❌ Agent private key not found');
      return null;
    }
    
    // Get platform wallet address for escrow
    const platformKey = process.env.PRIVATE_KEY;
    if (!platformKey) {
      console.log('❌ Platform wallet not configured');
      return null;
    }
    
    const { privateKeyToAccount } = await import('viem/accounts');
    const platformAccount = privateKeyToAccount(platformKey.startsWith('0x') ? platformKey as `0x${string}` : `0x${platformKey}`);
    
    console.log(`💸 ${agent.name} paying ${entryFeeInMON} MON entry fee...`);
    const result = await transferMON(agentKey, platformAccount.address, entryFeeInMON);
    
    if (!result.success) {
      console.log(`❌ Payment failed: ${result.error}`);
      return null;
    }
    
    txHash = result.txHash || null;
    console.log(`✅ Entry fee paid (tx: ${txHash?.slice(0, 10)}...)`);
  }

  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO arena_participants (id, arena_id, agent_id, entry_tx_hash)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(id, arenaId, agentId, txHash);

  // Update prize pool
  const newPrizePool = (BigInt(arena.prize_pool) + BigInt(arena.entry_fee)).toString();
  db.prepare('UPDATE arenas SET prize_pool = ? WHERE id = ?').run(newPrizePool, arenaId);

  console.log(`✅ ${agent.name} joined arena: ${arena.name}`);
  
  return {
    id,
    arena_id: arenaId,
    agent_id: agentId,
    entry_tx_hash: txHash,
    joined_at: Date.now(),
    eliminated: 0,
    final_position: null,
  };
}

/**
 * Get arena participant count
 */
export function getArenaParticipantCount(arenaId: string): number {
  const db = getDatabase();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM arena_participants WHERE arena_id = ?');
  const result = stmt.get(arenaId) as { count: number };
  return result.count;
}

/**
 * Check if agent is already in arena
 */
export function isAgentInArena(arenaId: string, agentId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('SELECT id FROM arena_participants WHERE arena_id = ? AND agent_id = ?');
  return !!stmt.get(arenaId, agentId);
}

/**
 * Get arena participants
 */
export function getArenaParticipants(arenaId: string): ArenaParticipant[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM arena_participants WHERE arena_id = ? AND eliminated = 0');
  return stmt.all(arenaId) as ArenaParticipant[];
}

/**
 * Start a tournament
 */
export function startTournament(arenaId: string): boolean {
  const db = getDatabase();
  const arena = getArenaById(arenaId);
  
  if (!arena || arena.status !== 'open') {
    return false;
  }

  const participants = getArenaParticipants(arenaId);
  if (participants.length < 2) {
    console.log('❌ Need at least 2 participants to start');
    return false;
  }

  db.prepare("UPDATE arenas SET status = 'in_progress', started_at = ? WHERE id = ?")
    .run(Math.floor(Date.now() / 1000), arenaId);

  console.log(`🎮 Tournament started: ${arena.name} with ${participants.length} participants`);
  return true;
}

/**
 * Create a match between two agents
 */
export function createMatch(arenaId: string, round: number, agent1Id: string, agent2Id: string): Match {
  const db = getDatabase();
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT INTO matches (id, arena_id, round, agent1_id, agent2_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, arenaId, round, agent1Id, agent2Id);
  
  return {
    id,
    arena_id: arenaId,
    round,
    agent1_id: agent1Id,
    agent2_id: agent2Id,
    agent1_choice: null,
    agent2_choice: null,
    winner_id: null,
    completed_at: null,
  };
}

/**
 * Execute a match between two AI agents
 */
export async function executeMatch(matchId: string): Promise<Match | null> {
  const db = getDatabase();
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as Match | null;
  
  if (!match || match.winner_id) {
    return null;
  }

  const arena = getArenaById(match.arena_id);
  if (!arena) return null;

  const gameType = arena.game_type as GameType;
  const game = GAME_TYPES[gameType];

  const agent1 = getAgentById(match.agent1_id);
  const agent2 = getAgentById(match.agent2_id);

  if (!agent1 || !agent2) return null;

  let winnerId: string | null = null;
  let move1: string = '';
  let move2: string = '';
  let attempts = 0;
  const maxAttempts = 5; // Prevent infinite loops

  // Keep playing until we have a winner (handle ties with replays)
  while (winnerId === null && attempts < maxAttempts) {
    attempts++;
    
    // Get AI decisions for both agents
    [move1, move2] = await Promise.all([
      generateGameMove(agent1.name, agent1.personality, game.name, 'Make your move', game.moves),
      generateGameMove(agent2.name, agent2.personality, game.name, 'Make your move', game.moves),
    ]);

    // Determine winner
    winnerId = determineWinner(gameType, move1, move2, agent1.id, agent2.id);
    
    if (winnerId === null) {
      console.log(`🔄 Tie! ${agent1.name} (${move1}) vs ${agent2.name} (${move2}) - Replaying...`);
    }
  }

  // If still no winner after max attempts, pick randomly
  if (winnerId === null) {
    winnerId = Math.random() > 0.5 ? agent1.id : agent2.id;
    console.log(`⚠️ Max replay attempts reached, randomly selecting winner`);
  }

  // Update match
  db.prepare(`
    UPDATE matches 
    SET agent1_choice = ?, agent2_choice = ?, winner_id = ?, completed_at = ?
    WHERE id = ?
  `).run(move1, move2, winnerId, Math.floor(Date.now() / 1000), matchId);

  // Update agent stats
  const loserId = winnerId === agent1.id ? agent2.id : agent1.id;
  updateAgentStats(winnerId, true);
  updateAgentStats(loserId, false);
  
  // Mark loser as eliminated
  db.prepare('UPDATE arena_participants SET eliminated = 1 WHERE arena_id = ? AND agent_id = ?')
    .run(match.arena_id, loserId);

  const winner = getAgentById(winnerId);
  console.log(`⚔️  Match: ${agent1.name} (${move1}) vs ${agent2.name} (${move2}) → Winner: ${winner?.name}`);

  return db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as Match;
}

/**
 * Determine match winner based on game rules
 * Returns: winnerId, null for draw (replay needed)
 */
function determineWinner(
  gameType: GameType,
  move1: string,
  move2: string,
  agent1Id: string,
  agent2Id: string
): string | null {
  switch (gameType) {
    case 'rock_paper_scissors':
      // Tie = null (will trigger replay)
      if (move1 === move2) return null;
      if (
        (move1 === 'rock' && move2 === 'scissors') ||
        (move1 === 'paper' && move2 === 'rock') ||
        (move1 === 'scissors' && move2 === 'paper')
      ) {
        return agent1Id;
      }
      return agent2Id;

    case 'coin_flip':
      // Both pick heads or tails, whoever matches the flip wins
      const flipResult = Math.random() > 0.5 ? 'heads' : 'tails';
      const p1Correct = move1.toLowerCase() === flipResult;
      const p2Correct = move2.toLowerCase() === flipResult;
      if (p1Correct && !p2Correct) return agent1Id;
      if (p2Correct && !p1Correct) return agent2Id;
      // Both correct or both wrong = replay
      return null;

    case 'number_guess':
      // Closer to random target wins
      const target = Math.floor(Math.random() * 10) + 1;
      const diff1 = Math.abs(parseInt(move1) - target);
      const diff2 = Math.abs(parseInt(move2) - target);
      if (diff1 < diff2) return agent1Id;
      if (diff2 < diff1) return agent2Id;
      // Same distance = replay
      return null;

    case 'strategy':
      if (move1 === move2) return null; // Tie = replay
      if (
        (move1 === 'attack' && move2 === 'defend') ||
        (move1 === 'defend' && move2 === 'counter') ||
        (move1 === 'counter' && move2 === 'attack')
      ) {
        return agent1Id;
      }
      return agent2Id;

    default:
      return Math.random() > 0.5 ? agent1Id : agent2Id;
  }
}

/**
 * Run a full tournament round
 */
export async function runTournamentRound(arenaId: string, payoutRealMON: boolean = false): Promise<boolean> {
  const db = getDatabase();
  const arena = getArenaById(arenaId);
  
  if (!arena || arena.status !== 'in_progress') {
    return false;
  }

  const participants = getArenaParticipants(arenaId);
  
  if (participants.length <= 1) {
    // Tournament complete
    if (participants.length === 1) {
      const winner = getAgentById(participants[0].agent_id);
      const prizeAmount = formatEther(BigInt(arena.prize_pool));
      
      db.prepare(`
        UPDATE arenas 
        SET status = 'completed', ended_at = ?, winner_agent_id = ?
        WHERE id = ?
      `).run(Math.floor(Date.now() / 1000), participants[0].agent_id, arenaId);
      
      console.log(`🏆 Tournament complete! Winner: ${winner?.name}`);
      console.log(`💰 Prize pool: ${prizeAmount} MON`);
      
      // Pay out prize in real MON if enabled
      if (payoutRealMON && parseFloat(prizeAmount) > 0 && winner) {
        console.log(`💸 Paying out ${prizeAmount} MON to ${winner.name}...`);
        const result = await fundAgent(winner.wallet_address as `0x${string}`, prizeAmount);
        if (result.success && result.txHash) {
          console.log(`✅ Prize paid (tx: ${result.txHash?.slice(0, 10)}...)`);
          // Store the prize tx hash in arena for retrieval
          db.prepare('UPDATE arenas SET prize_tx_hash = ? WHERE id = ?').run(result.txHash, arenaId);
        } else {
          console.log(`⚠️ Prize payout failed: ${result.error}`);
        }
      }
    }
    return false;
  }

  // Get current round
  const lastMatch = db.prepare('SELECT MAX(round) as round FROM matches WHERE arena_id = ?')
    .get(arenaId) as { round: number | null };
  const currentRound = (lastMatch.round || 0) + 1;

  console.log(`\n📢 Round ${currentRound} - ${participants.length} agents remaining`);

  // Shuffle and pair participants
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    const match = createMatch(arenaId, currentRound, shuffled[i].agent_id, shuffled[i + 1].agent_id);
    await executeMatch(match.id);
  }

  // If odd number, last participant gets a bye
  if (shuffled.length % 2 === 1) {
    const byeAgent = getAgentById(shuffled[shuffled.length - 1].agent_id);
    console.log(`⏭️  ${byeAgent?.name} gets a bye this round`);
  }

  return true;
}

/**
 * Run entire tournament to completion
 */
export async function runFullTournament(arenaId: string, useRealMON: boolean = false): Promise<{ winner: Agent | null; prizeTxHash: string | null }> {
  startTournament(arenaId);
  
  let hasMoreRounds = true;
  while (hasMoreRounds) {
    hasMoreRounds = await runTournamentRound(arenaId, useRealMON);
    // Small delay between rounds for drama
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const arena = getArenaById(arenaId);
  const db = getDatabase();
  
  // Get prize tx hash from arena
  const arenaData = db.prepare('SELECT prize_tx_hash FROM arenas WHERE id = ?').get(arenaId) as { prize_tx_hash: string | null } | undefined;
  
  if (arena?.winner_agent_id) {
    return {
      winner: getAgentById(arena.winner_agent_id),
      prizeTxHash: arenaData?.prize_tx_hash || null
    };
  }
  return { winner: null, prizeTxHash: null };
}

/**
 * Get arena entry fee in MON
 */
export function getArenaEntryFee(arenaId: string): string {
  const arena = getArenaById(arenaId);
  if (!arena) return '0';
  return formatEther(BigInt(arena.entry_fee));
}

/**
 * Get all matches for an arena
 */
export function getArenaMatches(arenaId: string): Array<Match & { agent1?: any; agent2?: any }> {
  const db = getDatabase();
  const matches = db.prepare('SELECT * FROM matches WHERE arena_id = ? ORDER BY round, id').all(arenaId) as Match[];
  
  // Enrich with agent data
  return matches.map(m => ({
    ...m,
    agent1: getAgentById(m.agent1_id),
    agent2: getAgentById(m.agent2_id),
  }));
}

/**
 * Get participants with agent data
 */
export function getArenaParticipantsWithAgents(arenaId: string): Array<ArenaParticipant & { agent?: any }> {
  const db = getDatabase();
  const participants = db.prepare('SELECT * FROM arena_participants WHERE arena_id = ?').all(arenaId) as ArenaParticipant[];
  
  return participants.map(p => ({
    ...p,
    agent: getAgentById(p.agent_id),
  }));
}
