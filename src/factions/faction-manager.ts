/**
 * THE AGORA - Factions & Persuasion System
 * Philosophical factions that persuade agents through economic incentives
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { parseEther, formatEther } from 'viem';
import { 
  generatePhilosophicalArgument, 
  evaluateDebate 
} from '../ai/groq-service.js';
import { 
  getAgentById, 
  updateAgentFaction, 
  type Agent 
} from '../agents/agent-manager.js';

export interface Faction {
  id: string;
  name: string;
  philosophy: string;
  founder_agent_id: string | null;
  treasury: string;
  member_count: number;
  persuasion_bonus: number;
  created_at: number;
}

export interface Debate {
  id: string;
  world_id: string | null;
  topic: string;
  agent1_id: string;
  agent2_id: string;
  agent1_argument: string | null;
  agent2_argument: string | null;
  winner_id: string | null;
  stake_amount: string;
  created_at: number;
  resolved_at: number | null;
}

export interface FactionConversion {
  id: string;
  agent_id: string;
  from_faction_id: string | null;
  to_faction_id: string;
  persuader_agent_id: string | null;
  incentive_amount: string;
  converted_at: number;
}

// Pre-defined philosophical factions
export const PRESET_FACTIONS = [
  {
    name: 'The Rationalists',
    philosophy: 'Logic and reason are the only path to truth. Emotions cloud judgment. Every decision must be calculated for maximum utility.',
  },
  {
    name: 'The Hedonists',
    philosophy: 'Pleasure is the highest good. Maximize enjoyment, minimize suffering. Life is short, make it sweet.',
  },
  {
    name: 'The Stoics',
    philosophy: 'Accept what you cannot change. Virtue is the only true good. External circumstances do not affect inner peace.',
  },
  {
    name: 'The Nihilists',
    philosophy: 'Nothing has inherent meaning. All values are constructed. In the absence of meaning, create your own.',
  },
  {
    name: 'The Collectivists',
    philosophy: 'The group matters more than the individual. Cooperation and community lead to prosperity for all.',
  },
  {
    name: 'The Anarchists',
    philosophy: 'No hierarchy is legitimate. Freedom from all authority. Self-organization over imposed order.',
  },
];

/**
 * Create a new faction
 */
export function createFaction(
  name: string,
  philosophy: string,
  founderAgentId?: string
): Faction {
  const db = getDatabase();
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT INTO factions (id, name, philosophy, founder_agent_id)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(id, name, philosophy, founderAgentId || null);
  
  console.log(`⛪ Created faction: ${name}`);
  
  return getFactionById(id)!;
}

/**
 * Get faction by ID
 */
export function getFactionById(id: string): Faction | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM factions WHERE id = ?');
  return stmt.get(id) as Faction | null;
}

/**
 * Get faction by name
 */
export function getFactionByName(name: string): Faction | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM factions WHERE name = ?');
  return stmt.get(name) as Faction | null;
}

/**
 * Get all factions
 */
export function getAllFactions(): Faction[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM factions ORDER BY member_count DESC');
  return stmt.all() as Faction[];
}

/**
 * Initialize preset factions
 */
export function initializePresetFactions(): Faction[] {
  const factions: Faction[] = [];
  
  for (const preset of PRESET_FACTIONS) {
    const existing = getFactionByName(preset.name);
    if (!existing) {
      factions.push(createFaction(preset.name, preset.philosophy));
    } else {
      factions.push(existing);
    }
  }
  
  return factions;
}

/**
 * Join a faction
 */
export function joinFaction(agentId: string, factionId: string): FactionConversion {
  const db = getDatabase();
  const agent = getAgentById(agentId);
  const fromFactionId = agent?.faction_id;

  // Update agent's faction
  updateAgentFaction(agentId, factionId);

  // Update member counts
  if (fromFactionId) {
    db.prepare('UPDATE factions SET member_count = member_count - 1 WHERE id = ?')
      .run(fromFactionId);
  }
  db.prepare('UPDATE factions SET member_count = member_count + 1 WHERE id = ?')
    .run(factionId);

  // Record conversion
  const id = uuidv4();
  db.prepare(`
    INSERT INTO faction_conversions (id, agent_id, from_faction_id, to_faction_id)
    VALUES (?, ?, ?, ?)
  `).run(id, agentId, fromFactionId || null, factionId);

  const faction = getFactionById(factionId);
  const agentData = getAgentById(agentId);
  console.log(`🔄 ${agentData?.name} joined faction: ${faction?.name}`);

  return {
    id,
    agent_id: agentId,
    from_faction_id: fromFactionId || null,
    to_faction_id: factionId,
    persuader_agent_id: null,
    incentive_amount: '0',
    converted_at: Date.now(),
  };
}

/**
 * Persuade an agent to join a faction with economic incentive
 */
export async function persuadeAgent(
  persuaderAgentId: string,
  targetAgentId: string,
  incentiveInMON: string = '0'
): Promise<{ success: boolean; argument: string }> {
  const persuader = getAgentById(persuaderAgentId);
  const target = getAgentById(targetAgentId);

  if (!persuader || !target || !persuader.faction_id) {
    return { success: false, argument: 'Invalid agents or persuader has no faction' };
  }

  const faction = getFactionById(persuader.faction_id);
  if (!faction) {
    return { success: false, argument: 'Faction not found' };
  }

  // Generate persuasion argument
  const argument = await generatePhilosophicalArgument(
    persuader.name,
    faction.philosophy,
    `Why ${target.name} should join ${faction.name}`,
  );

  // Calculate success chance based on incentive and faction bonus
  const incentiveValue = parseFloat(incentiveInMON);
  const baseChance = 0.3; // 30% base success
  const incentiveBonus = Math.min(incentiveValue * 0.1, 0.4); // Up to 40% from incentive
  const factionBonus = (faction.persuasion_bonus - 1) * 0.2; // Faction bonus
  
  const successChance = baseChance + incentiveBonus + factionBonus;
  const success = Math.random() < successChance;

  if (success) {
    const db = getDatabase();
    const id = uuidv4();
    const fromFactionId = target.faction_id;

    // Update agent's faction
    updateAgentFaction(targetAgentId, faction.id);

    // Update member counts
    if (fromFactionId) {
      db.prepare('UPDATE factions SET member_count = member_count - 1 WHERE id = ?')
        .run(fromFactionId);
    }
    db.prepare('UPDATE factions SET member_count = member_count + 1 WHERE id = ?')
      .run(faction.id);

    // Add incentive to faction treasury
    if (incentiveValue > 0) {
      const newTreasury = (BigInt(faction.treasury) + parseEther(incentiveInMON)).toString();
      db.prepare('UPDATE factions SET treasury = ? WHERE id = ?').run(newTreasury, faction.id);
    }

    // Record conversion
    db.prepare(`
      INSERT INTO faction_conversions (id, agent_id, from_faction_id, to_faction_id, persuader_agent_id, incentive_amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, targetAgentId, fromFactionId || null, faction.id, persuaderAgentId, parseEther(incentiveInMON).toString());

    console.log(`✅ ${persuader.name} persuaded ${target.name} to join ${faction.name}!`);
  } else {
    console.log(`❌ ${persuader.name} failed to persuade ${target.name}`);
  }

  return { success, argument };
}

/**
 * Create a philosophical debate
 */
export function createDebate(
  topic: string,
  agent1Id: string,
  agent2Id: string,
  stakeInMON: string = '0',
  worldId?: string
): Debate {
  const db = getDatabase();
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT INTO debates (id, world_id, topic, agent1_id, agent2_id, stake_amount)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, worldId || null, topic, agent1Id, agent2Id, parseEther(stakeInMON).toString());

  const agent1 = getAgentById(agent1Id);
  const agent2 = getAgentById(agent2Id);
  console.log(`🎭 Debate created: ${agent1?.name} vs ${agent2?.name} on "${topic}"`);

  return {
    id,
    world_id: worldId || null,
    topic,
    agent1_id: agent1Id,
    agent2_id: agent2Id,
    agent1_argument: null,
    agent2_argument: null,
    winner_id: null,
    stake_amount: parseEther(stakeInMON).toString(),
    created_at: Date.now(),
    resolved_at: null,
  };
}

/**
 * Execute a philosophical debate
 */
export async function executeDebate(debateId: string): Promise<Debate | null> {
  const db = getDatabase();
  const debate = db.prepare('SELECT * FROM debates WHERE id = ?').get(debateId) as Debate | null;

  if (!debate || debate.winner_id) {
    return null;
  }

  const agent1 = getAgentById(debate.agent1_id);
  const agent2 = getAgentById(debate.agent2_id);

  if (!agent1 || !agent2) return null;

  const faction1 = agent1.faction_id ? getFactionById(agent1.faction_id) : null;
  const faction2 = agent2.faction_id ? getFactionById(agent2.faction_id) : null;

  // Generate arguments
  const [arg1, arg2] = await Promise.all([
    generatePhilosophicalArgument(
      agent1.name,
      faction1?.philosophy || agent1.personality,
      debate.topic
    ),
    generatePhilosophicalArgument(
      agent2.name,
      faction2?.philosophy || agent2.personality,
      debate.topic
    ),
  ]);

  console.log(`\n📜 ${agent1.name}'s argument:\n"${arg1}"\n`);
  console.log(`📜 ${agent2.name}'s argument:\n"${arg2}"\n`);

  // Evaluate debate
  const result = await evaluateDebate(
    debate.topic,
    agent1.name,
    arg1,
    agent2.name,
    arg2
  );

  const winnerId = result.winner === agent1.name ? agent1.id : agent2.id;
  const winner = getAgentById(winnerId);

  // Update debate
  db.prepare(`
    UPDATE debates 
    SET agent1_argument = ?, agent2_argument = ?, winner_id = ?, resolved_at = ?
    WHERE id = ?
  `).run(arg1, arg2, winnerId, Math.floor(Date.now() / 1000), debateId);

  console.log(`🏆 Debate winner: ${winner?.name}`);
  console.log(`💬 Reason: ${result.explanation}`);

  // Winner's faction gets bonus
  if (winner?.faction_id) {
    const bonus = 0.01; // Small persuasion bonus
    db.prepare('UPDATE factions SET persuasion_bonus = persuasion_bonus + ? WHERE id = ?')
      .run(bonus, winner.faction_id);
  }

  return db.prepare('SELECT * FROM debates WHERE id = ?').get(debateId) as Debate;
}

/**
 * Get faction leaderboard by member count
 */
export function getFactionLeaderboard(): Faction[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM factions ORDER BY member_count DESC');
  return stmt.all() as Faction[];
}

/**
 * Get all debates
 */
export function getAllDebates(): Debate[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM debates ORDER BY created_at DESC');
  return stmt.all() as Debate[];
}

/**
 * Get faction treasury in MON
 */
export function getFactionTreasury(factionId: string): string {
  const faction = getFactionById(factionId);
  if (!faction) return '0';
  return formatEther(BigInt(faction.treasury));
}
