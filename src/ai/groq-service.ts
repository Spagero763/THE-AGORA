/**
 * THE AGORA - AI Service
 * Groq integration for agent decision-making (FREE!)
 */

import Groq from 'groq-sdk';

let groqClient: Groq | null = null;

/**
 * Initialize Groq client
 */
export function initializeAI(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️  GROQ_API_KEY not set. AI features will use mock responses.');
    console.warn('   Get a FREE key at: https://console.groq.com');
  }
  
  groqClient = new Groq({
    apiKey: apiKey || 'mock-key',
  });
  
  return groqClient;
}

/**
 * Get AI client
 */
export function getAI(): Groq | null {
  return groqClient;
}

/**
 * Generate AI response for agent actions
 */
export async function generateAgentResponse(
  agentName: string,
  personality: string,
  context: string,
  options: string[]
): Promise<{ choice: string; reasoning: string }> {
  
  // If no API key, use mock decision
  if (!process.env.GROQ_API_KEY) {
    const randomChoice = options[Math.floor(Math.random() * options.length)];
    return {
      choice: randomChoice,
      reasoning: `[Mock AI] ${agentName} chose ${randomChoice} randomly.`,
    };
  }

  const prompt = `You are ${agentName}, an AI agent with this personality: ${personality}

Current situation: ${context}

Available options: ${options.join(', ')}

Choose ONE option and explain briefly. Respond in JSON format:
{"choice": "option_name", "reasoning": "brief explanation"}`;

  try {
    const completion = await groqClient!.chat.completions.create({
      model: 'llama-3.1-8b-instant', // Fast and free
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content;
    if (response) {
      return JSON.parse(response);
    }
  } catch (error) {
    console.error('AI generation error:', error);
  }

  // Fallback
  return {
    choice: options[0],
    reasoning: 'Default choice due to AI error.',
  };
}

/**
 * Generate philosophical argument for debates
 */
export async function generatePhilosophicalArgument(
  agentName: string,
  factionPhilosophy: string,
  topic: string,
  opponentArgument?: string
): Promise<string> {
  
  if (!process.env.GROQ_API_KEY || !groqClient) {
    return `[Mock] ${agentName} argues passionately about ${topic} from the ${factionPhilosophy} perspective.`;
  }

  const prompt = `You are ${agentName}, a philosophical agent who believes: "${factionPhilosophy}"

Topic of debate: ${topic}
${opponentArgument ? `Opponent's argument: ${opponentArgument}` : ''}

Make a compelling philosophical argument (2-3 sentences). Be persuasive and reference your core beliefs.`;

  try {
    const completion = await groqClient.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 200,
    });

    return completion.choices[0]?.message?.content || 'No argument generated.';
  } catch (error) {
    console.error('Argument generation error:', error);
    return `${agentName} makes a thoughtful point about ${topic}.`;
  }
}

/**
 * Generate game move decision
 */
export async function generateGameMove(
  agentName: string,
  personality: string,
  gameType: string,
  gameState: string,
  validMoves: string[]
): Promise<string> {
  
  if (!process.env.GROQ_API_KEY || !groqClient) {
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  const prompt = `You are ${agentName} (${personality}) playing ${gameType}.

Current game state: ${gameState}
Valid moves: ${validMoves.join(', ')}

Choose your move. Respond with ONLY the move name, nothing else.`;

  try {
    const completion = await groqClient.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 20,
    });

    const move = completion.choices[0]?.message?.content?.trim().toLowerCase();
    
    // Validate move
    const validMove = validMoves.find(m => 
      m.toLowerCase() === move || move?.includes(m.toLowerCase())
    );
    
    return validMove || validMoves[0];
  } catch (error) {
    console.error('Move generation error:', error);
    return validMoves[0];
  }
}

/**
 * Evaluate debate winner based on arguments
 */
export async function evaluateDebate(
  topic: string,
  agent1Name: string,
  agent1Argument: string,
  agent2Name: string,
  agent2Argument: string
): Promise<{ winner: string; explanation: string }> {
  
  if (!process.env.GROQ_API_KEY) {
    const winner = Math.random() > 0.5 ? agent1Name : agent2Name;
    return {
      winner,
      explanation: `[Mock] ${winner} won the debate through sheer luck.`,
    };
  }

  const prompt = `Judge this philosophical debate on "${topic}":

${agent1Name}'s argument: "${agent1Argument}"

${agent2Name}'s argument: "${agent2Argument}"

Who made the more compelling argument? Respond in JSON:
{"winner": "name", "explanation": "brief reason"}`;

  try {
    const completion = await groqClient!.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content;
    if (response) {
      return JSON.parse(response);
    }
  } catch (error) {
    console.error('Debate evaluation error:', error);
  }

  return {
    winner: agent1Name,
    explanation: 'Default winner due to evaluation error.',
  };
}
