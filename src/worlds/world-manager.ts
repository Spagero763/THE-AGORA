/**
 * THE AGORA - World Model
 * Virtual worlds where agents can join, interact, and transact
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { parseEther, formatEther } from 'viem';

export interface World {
  id: string;
  name: string;
  description: string;
  creator_address: string;
  entry_fee: string;
  created_at: number;
  is_active: number;
}

export interface WorldMember {
  id: string;
  world_id: string;
  agent_id: string;
  joined_at: number;
  entry_tx_hash: string | null;
}

export interface CreateWorldParams {
  name: string;
  description: string;
  creatorAddress: string;
  entryFeeInMON?: string;
}

/**
 * Create a new virtual world
 */
export function createWorld(params: CreateWorldParams): World {
  const db = getDatabase();
  const id = uuidv4();
  const entryFee = params.entryFeeInMON 
    ? parseEther(params.entryFeeInMON).toString()
    : '0';

  const stmt = db.prepare(`
    INSERT INTO worlds (id, name, description, creator_address, entry_fee)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, params.name, params.description, params.creatorAddress, entryFee);
  
  console.log(`🌍 Created world: ${params.name} (Entry fee: ${params.entryFeeInMON || '0'} MON)`);
  
  return getWorldById(id)!;
}

/**
 * Get world by ID
 */
export function getWorldById(id: string): World | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM worlds WHERE id = ?');
  return stmt.get(id) as World | null;
}

/**
 * Get all active worlds
 */
export function getAllWorlds(): World[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM worlds WHERE is_active = 1 ORDER BY created_at DESC');
  return stmt.all() as World[];
}

/**
 * Join an agent to a world
 */
export function joinWorld(
  worldId: string,
  agentId: string,
  txHash?: string
): WorldMember {
  const db = getDatabase();
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO world_members (id, world_id, agent_id, entry_tx_hash)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(id, worldId, agentId, txHash || null);
  
  const world = getWorldById(worldId);
  console.log(`✅ Agent joined world: ${world?.name}`);
  
  return { id, world_id: worldId, agent_id: agentId, joined_at: Date.now(), entry_tx_hash: txHash || null };
}

/**
 * Check if agent is in a world
 */
export function isAgentInWorld(worldId: string, agentId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT 1 FROM world_members WHERE world_id = ? AND agent_id = ?
  `);
  return stmt.get(worldId, agentId) !== undefined;
}

/**
 * Get all agents in a world
 */
export function getWorldMembers(worldId: string): Array<WorldMember & { agent?: any }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT wm.*, a.name as agent_name, a.wallet_address as agent_address, a.personality as agent_personality
    FROM world_members wm
    LEFT JOIN agents a ON wm.agent_id = a.id
    WHERE wm.world_id = ?
  `);
  const members = stmt.all(worldId) as any[];
  return members.map(m => ({
    ...m,
    agent: m.agent_name ? { name: m.agent_name, address: m.agent_address, personality: m.agent_personality } : undefined
  }));
}

/**
 * Get world member count
 */
export function getWorldMemberCount(worldId: string): number {
  const db = getDatabase();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM world_members WHERE world_id = ?');
  const result = stmt.get(worldId) as { count: number };
  return result.count;
}

/**
 * Leave a world
 */
export function leaveWorld(worldId: string, agentId: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM world_members WHERE world_id = ? AND agent_id = ?');
  stmt.run(worldId, agentId);
}

/**
 * Deactivate a world
 */
export function deactivateWorld(worldId: string): void {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE worlds SET is_active = 0 WHERE id = ?');
  stmt.run(worldId);
}

/**
 * Get world entry fee in MON
 */
export function getWorldEntryFee(worldId: string): string {
  const world = getWorldById(worldId);
  if (!world) return '0';
  return formatEther(BigInt(world.entry_fee));
}

/**
 * Get worlds with most members
 */
export function getPopularWorlds(limit: number = 10): Array<World & { member_count: number }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT w.*, COUNT(wm.id) as member_count
    FROM worlds w
    LEFT JOIN world_members wm ON w.id = wm.world_id
    WHERE w.is_active = 1
    GROUP BY w.id
    ORDER BY member_count DESC
    LIMIT ?
  `);
  return stmt.all(limit) as Array<World & { member_count: number }>;
}
