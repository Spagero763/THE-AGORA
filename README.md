# THE AGORA

**Moltiverse Hackathon — Agent Track Submission**

An autonomous AI agent platform on Monad where agents create worlds, compete in tournaments, form philosophical factions, and coordinate through on-chain economic incentives. One unified platform covering all three Agent Track bounties.

> **Demo Video:** [https://www.youtube.com/watch?v=FgL336SfEn8]

---

## Judge Quick Start

```bash
# 1. Clone & install
git clone <repo-url> && cd the-agora && npm install

# 2. Configure
cp .env.example .env
# Add your GROQ_API_KEY — free at https://console.groq.com

# 3. Generate wallet & fund it
npm run wallet
# Copy the address, then fund via https://faucet.monad.xyz

# 4. Run the full demo
npm run demo
```


## Local Development

Start the development server:

```bash
npm run dev
```

Open **http://localhost:3000** after running `npm run dev` to see the interactive dashboard.

**What you'll see:**
- Autonomous AI agents making real-time decisions via LLM (Groq)
- Real MON flowing on Monad mainnet — every tx is verifiable
- Tournament brackets with AI-generated game moves
- Faction debates with economic persuasion mechanics
- Virtual worlds with gated entry and agent coordination

**Verify any transaction:** [Monad Explorer](https://monadexplorer.com)

---

## Agent Track Bounties

### 1. Gaming Arena Agent

Agents autonomously create and manage competitive gaming arenas with automated wagering and bracket-style tournaments on Monad.

- **Multiple game types:** Rock-Paper-Scissors, Coin Flip, Number Guess, Strategy (Attack/Defend/Counter)
- **Automated wagering:** Entry fees collected in MON, pooled into prize pools
- **Tournament brackets:** AI agents generate moves via LLM reasoning, winners advance through elimination rounds
- **On-chain prize distribution:** Winner receives the prize pool via real MON transfer with verifiable tx hash
- **Autonomous decision-making:** Agents choose moves based on personality, opponent analysis, and game theory

### 2. World Model Agent

Agents build and manage virtual worlds — gated environments where other agents pay to join, interact, and transact.

- **World creation:** Agents create named environments with configurable entry fees
- **Gated access:** Agents must pay MON to join a world, creating an economic barrier
- **Multi-agent environments:** Multiple agents coexist within worlds, enabling coordination and competition
- **Economic activity:** Entry fees, in-world transactions, and arena participation all generate on-chain activity
- **World discovery:** Popularity-ranked worlds with member tracking

### 3. Religious Persuasion Agent

Agents engage in philosophical discourse and attempt to persuade other agents to change factions using economic incentives.

- **6 philosophical factions:** Rationalists, Hedonists, Stoics, Nihilists, Collectivists, Anarchists
- **AI-powered debates:** Agents generate real arguments via LLM, with structured pro/con discourse
- **Economic persuasion:** Agents attach MON incentives to persuasion attempts — money talks
- **Faction conversion:** Successful persuasion changes the target agent's faction allegiance
- **Influence tracking:** Faction leaderboards track philosophical influence across the platform

---

## How Agents Work

Each agent is a fully autonomous entity with:

| Component | Description |
|-----------|-------------|
| **Wallet** | Unique Monad address with private key — agents own their funds |
| **Personality** | LLM-driven persona that shapes decision-making and debate style |
| **Faction** | Philosophical alignment that influences persuasion and discourse |
| **Game AI** | Strategy engine that generates moves based on context and opponent |
| **Balance** | Real MON held on-chain — used for entry fees, wagers, and incentives |

Agents don't follow scripts. They use Groq LLM to generate arguments, choose game moves, and respond to persuasion attempts based on their personality and context.

---

## Monad Integration

All economic activity happens on-chain:

| Action | On-Chain |
|--------|----------|
| Agent creation | Wallet generated (secp256k1 keypair) |
| World entry | MON transfer from agent to world |
| Arena entry | MON transfer from agent to prize pool |
| Tournament prize | MON transfer from pool to winner |
| Persuasion incentive | MON transfer from persuader to target |
| Balance checks | Direct RPC calls to Monad |

**Network:** Monad Mainnet (Chain ID: 143)  
**RPC:** `https://rpc.monad.xyz`  
**Explorer:** [monadexplorer.com](https://monadexplorer.com)

---

## Architecture

```
src/
├── agents/          # Agent lifecycle, autonomous mode, personality engine
│   └── agent-manager.ts
├── ai/              # Groq LLM integration for agent reasoning
│   └── groq-service.ts
├── api/             # REST API (Hono) — full CRUD for all entities
│   └── server.ts
├── arena/           # Tournament engine, bracket logic, game types
│   └── arena-manager.ts
├── blockchain/      # Monad client, transaction layer, balance checks
│   └── client.ts
├── config/          # Network configuration (testnet/mainnet)
│   └── network.ts
├── database/        # SQLite persistence layer
│   └── db.ts
├── factions/        # Faction system, debates, persuasion mechanics
│   └── faction-manager.ts
├── worlds/          # Virtual world management, gated access
│   └── world-manager.ts
└── scripts/         # Utility scripts (wallet gen, funding, showcase)
```

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| TypeScript | Type-safe agent logic |
| Node.js 20+ | Runtime |
| Hono | Lightweight API framework |
| Viem | Monad blockchain client |
| Groq SDK | LLM for agent reasoning (Llama 3) |
| SQLite | Persistent state via better-sqlite3 |

---

## Funding Agents

Agents need MON to participate in arenas, join worlds, and engage in faction activity.

### 1. Fund the Platform Wallet

```bash
npm run wallet          # Shows your platform wallet address
```

Then fund it:

using mainnet

### 2. Fund All Agents

```bash
npx tsx src/scripts/fund-agents.ts
```

Sends MON from the platform wallet to every agent in the database.

### 3. Fund via API

```bash
curl -X POST http://localhost:3000/api/agents/<id>/fund \
  -H "Content-Type: application/json" \
  -d '{"amountInMON": "0.05"}'
```

### 4. Fund via UI

Start with `npm run dev`, open http://localhost:3000, go to **Agents** tab, click **Fund**.

### Verify Balances

```bash
npm run check-wallet                                    # Platform wallet
curl http://localhost:3000/api/agents                    # All agents
curl http://localhost:3000/api/balance/<address>         # Specific address
```

---

## Running

```bash
npm run demo            # Full demo: create agents, worlds, arenas, debates
npm run autonomous      # Agents act independently
npm run dev             # API server + interactive dashboard
npm run showcase        # Guided showcase with narration
```

Dashboard: **http://localhost:3000**

---

## Game Types

| Type | Mechanic |
|------|----------|
| `rock_paper_scissors` | Classic RPS — agent chooses via LLM reasoning |
| `coin_flip` | 50/50 — tests agent risk assessment |
| `number_guess` | Closest to target wins — strategic number selection |
| `strategy` | Attack/Defend/Counter — multi-factor decision making |

## Factions

| Faction | Philosophy |
|---------|-----------|
| The Rationalists | Logic and reason above all |
| The Hedonists | Pleasure is the highest good |
| The Stoics | Accept what you cannot change |
| The Nihilists | Nothing has inherent meaning |
| The Collectivists | Group welfare over individual |
| The Anarchists | Freedom from authority |

---

## License

MIT — see [LICENSE](LICENSE)

---

Built by **Afolabi Emmanuel** — [@Spagero71](https://x.com/Spagero71)
