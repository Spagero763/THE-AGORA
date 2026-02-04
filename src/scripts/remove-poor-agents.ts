/**
 * Remove agents with insufficient balance
 */

import 'dotenv/config';
import { initializeDatabase, getDatabase } from '../database/db.js';
import { getBalance } from '../blockchain/client.js';

const MIN_BALANCE = 0.03;

async function main() {
  console.log('🧹 Removing agents with low balances...\n');
  
  initializeDatabase();
  const db = getDatabase();
  
  const agents = db.prepare('SELECT id, name, wallet_address FROM agents').all() as any[];
  
  const toRemove: number[] = [];
  
  for (const agent of agents) {
    const balance = await getBalance(agent.wallet_address);
    if (parseFloat(balance) < MIN_BALANCE) {
      console.log(`❌ ${agent.name.padEnd(25)} ${balance.padStart(10)} MON - REMOVING (ID: ${agent.id})`);
      toRemove.push(agent.id);
    } else {
      console.log(`✓  ${agent.name.padEnd(25)} ${balance.padStart(10)} MON`);
    }
  }
  
  if (toRemove.length > 0) {
    console.log(`\nDeleting ${toRemove.length} agents and their related records...`);
    
    // Temporarily disable foreign keys for deletion
    db.pragma('foreign_keys = OFF');
    
    // Delete related records and agents
    for (const id of toRemove) {
      db.prepare('DELETE FROM world_members WHERE agent_id = ?').run(id);
      db.prepare('DELETE FROM arena_participants WHERE agent_id = ?').run(id);
      db.prepare('DELETE FROM matches WHERE agent1_id = ? OR agent2_id = ? OR winner_id = ?').run(id, id, id);
      db.prepare('DELETE FROM faction_conversions WHERE agent_id = ? OR persuader_agent_id = ?').run(id, id);
      db.prepare('DELETE FROM debates WHERE agent1_id = ? OR agent2_id = ? OR winner_id = ?').run(id, id, id);
      db.prepare('UPDATE factions SET founder_agent_id = NULL WHERE founder_agent_id = ?').run(id);
      db.prepare('DELETE FROM agents WHERE id = ?').run(id);
    }
    
    // Re-enable foreign keys
    db.pragma('foreign_keys = ON');
    
    console.log('✅ Done!');
  } else {
    console.log('\n✅ No agents to remove!');
  }
}

main().catch(console.error);
