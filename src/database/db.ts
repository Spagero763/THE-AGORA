/**
 * THE AGORA - Database Setup
 * SQLite database for storing worlds, agents, tournaments, and factions
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'agora.db');

let db: Database.Database | null = null;

/**
 * Initialize the database with all required tables
 */
export function initializeDatabase(): Database.Database {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    -- =============================================
    -- WORLD MODEL: Virtual realms agents can join
    -- =============================================
    CREATE TABLE IF NOT EXISTS worlds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      creator_address TEXT NOT NULL,
      entry_fee TEXT DEFAULT '0',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      is_active INTEGER DEFAULT 1
    );

    -- Agents currently in a world
    CREATE TABLE IF NOT EXISTS world_members (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      joined_at INTEGER DEFAULT (strftime('%s', 'now')),
      entry_tx_hash TEXT,
      FOREIGN KEY (world_id) REFERENCES worlds(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      UNIQUE(world_id, agent_id)
    );

    -- =============================================
    -- AGENTS: AI agents in the system
    -- =============================================
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      wallet_address TEXT UNIQUE NOT NULL,
      private_key_encrypted TEXT,
      personality TEXT,
      faction_id TEXT,
      balance TEXT DEFAULT '0',
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (faction_id) REFERENCES factions(id)
    );

    -- =============================================
    -- GAMING ARENA: Tournaments and matches
    -- =============================================
    CREATE TABLE IF NOT EXISTS arenas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      game_type TEXT NOT NULL,
      world_id TEXT,
      entry_fee TEXT DEFAULT '0',
      prize_pool TEXT DEFAULT '0',
      max_participants INTEGER DEFAULT 8,
      status TEXT DEFAULT 'open',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      started_at INTEGER,
      ended_at INTEGER,
      winner_agent_id TEXT,
      prize_tx_hash TEXT,
      FOREIGN KEY (world_id) REFERENCES worlds(id),
      FOREIGN KEY (winner_agent_id) REFERENCES agents(id)
    );

    -- Tournament participants
    CREATE TABLE IF NOT EXISTS arena_participants (
      id TEXT PRIMARY KEY,
      arena_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      entry_tx_hash TEXT,
      joined_at INTEGER DEFAULT (strftime('%s', 'now')),
      eliminated INTEGER DEFAULT 0,
      final_position INTEGER,
      FOREIGN KEY (arena_id) REFERENCES arenas(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      UNIQUE(arena_id, agent_id)
    );

    -- Individual matches within tournaments
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      arena_id TEXT NOT NULL,
      round INTEGER NOT NULL,
      agent1_id TEXT NOT NULL,
      agent2_id TEXT NOT NULL,
      agent1_choice TEXT,
      agent2_choice TEXT,
      winner_id TEXT,
      completed_at INTEGER,
      FOREIGN KEY (arena_id) REFERENCES arenas(id),
      FOREIGN KEY (agent1_id) REFERENCES agents(id),
      FOREIGN KEY (agent2_id) REFERENCES agents(id),
      FOREIGN KEY (winner_id) REFERENCES agents(id)
    );

    -- =============================================
    -- FACTIONS: Philosophical/religious groups
    -- =============================================
    CREATE TABLE IF NOT EXISTS factions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      philosophy TEXT NOT NULL,
      founder_agent_id TEXT,
      treasury TEXT DEFAULT '0',
      member_count INTEGER DEFAULT 0,
      persuasion_bonus REAL DEFAULT 1.0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (founder_agent_id) REFERENCES agents(id)
    );

    -- Faction membership history
    CREATE TABLE IF NOT EXISTS faction_conversions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      from_faction_id TEXT,
      to_faction_id TEXT NOT NULL,
      persuader_agent_id TEXT,
      incentive_amount TEXT DEFAULT '0',
      converted_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (from_faction_id) REFERENCES factions(id),
      FOREIGN KEY (to_faction_id) REFERENCES factions(id),
      FOREIGN KEY (persuader_agent_id) REFERENCES agents(id)
    );

    -- Philosophical debates between agents
    CREATE TABLE IF NOT EXISTS debates (
      id TEXT PRIMARY KEY,
      world_id TEXT,
      topic TEXT NOT NULL,
      agent1_id TEXT NOT NULL,
      agent2_id TEXT NOT NULL,
      agent1_argument TEXT,
      agent2_argument TEXT,
      winner_id TEXT,
      stake_amount TEXT DEFAULT '0',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      resolved_at INTEGER,
      FOREIGN KEY (world_id) REFERENCES worlds(id),
      FOREIGN KEY (agent1_id) REFERENCES agents(id),
      FOREIGN KEY (agent2_id) REFERENCES agents(id),
      FOREIGN KEY (winner_id) REFERENCES agents(id)
    );

    -- =============================================
    -- TRANSACTIONS: On-chain activity log
    -- =============================================
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      tx_hash TEXT UNIQUE,
      from_address TEXT NOT NULL,
      to_address TEXT,
      amount TEXT,
      tx_type TEXT NOT NULL,
      reference_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      confirmed INTEGER DEFAULT 0
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_agents_wallet ON agents(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_agents_faction ON agents(faction_id);
    CREATE INDEX IF NOT EXISTS idx_world_members_world ON world_members(world_id);
    CREATE INDEX IF NOT EXISTS idx_arena_participants_arena ON arena_participants(arena_id);
    CREATE INDEX IF NOT EXISTS idx_matches_arena ON matches(arena_id);
  `);

  console.log('✅ Database initialized');
  return db;
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    return initializeDatabase();
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
