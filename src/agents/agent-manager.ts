/**
 * THE AGORA - Agent Manager
 * Core agent creation and management
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import crypto from 'crypto';

// Simple encryption for private keys (in production, use proper KMS)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'the-agora-default-key-32bytes!!';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export interface Agent {
  id: string;
  name: string;
  wallet_address: string;
  personality: string;
  faction_id: string | null;
  balance: string;
  wins: number;
  losses: number;
  created_at: number;
}

export interface CreateAgentParams {
  name: string;
  personality: string;
  privateKey?: string;
}

/**
 * Create a new AI agent with its own wallet
 */
export function createAgent(params: CreateAgentParams): { agent: Agent; privateKey: string } {
  const db = getDatabase();
  const id = uuidv4();
  
  // Generate or use provided private key
  const privateKey = params.privateKey || generatePrivateKey();
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  // Encrypt private key for storage
  const encryptedKey = encrypt(privateKey);
  
  const stmt = db.prepare(`
    INSERT INTO agents (id, name, wallet_address, private_key_encrypted, personality)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, params.name, account.address, encryptedKey, params.personality);
  
  const agent = getAgentById(id)!;
  
  console.log(`✅ Created agent: ${params.name} (${account.address})`);
  
  return { agent, privateKey };
}

/**
 * Get agent by ID
 */
export function getAgentById(id: string): Agent | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM agents WHERE id = ?');
  return stmt.get(id) as Agent | null;
}

/**
 * Get agent by wallet address
 */
export function getAgentByAddress(address: string): Agent | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM agents WHERE wallet_address = ?');
  return stmt.get(address.toLowerCase()) as Agent | null;
}

/**
 * Get agent's private key (decrypted)
 */
export function getAgentPrivateKey(agentId: string): string | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT private_key_encrypted FROM agents WHERE id = ?');
  const result = stmt.get(agentId) as { private_key_encrypted: string | null } | undefined;
  
  if (!result?.private_key_encrypted) {
    return null;
  }
  
  try {
    return decrypt(result.private_key_encrypted);
  } catch {
    return null;
  }
}

/**
 * Get all agents
 */
export function getAllAgents(): Agent[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM agents ORDER BY created_at DESC');
  return stmt.all() as Agent[];
}

/**
 * Get agents in a faction
 */
export function getAgentsByFaction(factionId: string): Agent[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM agents WHERE faction_id = ?');
  return stmt.all(factionId) as Agent[];
}

/**
 * Update agent's faction
 */
export function updateAgentFaction(agentId: string, factionId: string | null): void {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE agents SET faction_id = ? WHERE id = ?');
  stmt.run(factionId, agentId);
}

/**
 * Update agent stats after a match
 */
export function updateAgentStats(agentId: string, won: boolean): void {
  const db = getDatabase();
  const column = won ? 'wins' : 'losses';
  const stmt = db.prepare(`UPDATE agents SET ${column} = ${column} + 1 WHERE id = ?`);
  stmt.run(agentId);
}

/**
 * Update agent balance (internal tracking)
 */
export function updateAgentBalance(agentId: string, newBalance: string): void {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE agents SET balance = ? WHERE id = ?');
  stmt.run(newBalance, agentId);
}

/**
 * Get leaderboard by wins
 */
export function getLeaderboard(limit: number = 10): Agent[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM agents 
    ORDER BY wins DESC, (wins - losses) DESC 
    LIMIT ?
  `);
  return stmt.all(limit) as Agent[];
}

// Pre-defined agent personalities for variety
export const AGENT_PERSONALITIES = [
  'Aggressive and risk-taking. Always goes for the bold move.',
  'Cautious and analytical. Prefers safe, calculated decisions.',
  'Chaotic and unpredictable. Makes random choices for fun.',
  'Strategic mastermind. Plans several moves ahead.',
  'Friendly diplomat. Prefers cooperation over competition.',
  'Ruthless competitor. Winning is everything.',
  'Philosophical thinker. Questions the nature of every decision.',
  'Loyal follower. Sticks with the group consensus.',
];

/**
 * Get a random personality
 */
export function getRandomPersonality(): string {
  return AGENT_PERSONALITIES[Math.floor(Math.random() * AGENT_PERSONALITIES.length)];
}
