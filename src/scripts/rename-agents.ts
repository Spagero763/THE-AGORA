/**
 * Rename agents to uppercase stylized names
 */
import { getDatabase, initializeDatabase } from '../database/db.js';

initializeDatabase();

const nameMap: Record<string, string> = {
  'phantom': 'PHANTOM',
  'cipher': 'CIPHER',
  'specter': 'SPECTER',
  'vortex': 'VORTEX',
  'nexus': 'NEXUS',
  'raven': 'RAVEN',
  'ghost': 'GHOST',
  'echo': 'ECHO',
};

const db = getDatabase();
const agents = db.prepare('SELECT id, name FROM agents').all() as { id: string; name: string }[];

console.log(`\n🔄 Renaming ${agents.length} agents...\n`);

for (const agent of agents) {
  const newName = nameMap[agent.name.toLowerCase()] || agent.name.toUpperCase();
  if (newName !== agent.name) {
    db.prepare('UPDATE agents SET name = ? WHERE id = ?').run(newName, agent.id);
    console.log(`  ✅ ${agent.name} → ${newName}`);
  } else {
    console.log(`  ⏭  ${agent.name} (already correct)`);
  }
}

console.log('\n✅ All agents renamed!\n');
