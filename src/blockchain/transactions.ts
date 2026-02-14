/**
 * THE AGORA - On-Chain Transaction Service
 * Handles real MON transfers on Monad testnet
 */

import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getMonadChain, getNetworkConfig } from '../config/network.js';
import { getDatabase } from '../database/db.js';

const chain = getMonadChain();
const config = getNetworkConfig();

/**
 * Create a wallet client for an agent using their private key
 */
export function createAgentWallet(privateKey: string) {
  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);
  
  const client = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
  });
  
  return { client, account };
}

/**
 * Get public client for reading chain state
 */
export function getPublicClient() {
  return createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });
}

/**
 * Check balance of an address
 */
export async function checkBalance(address: `0x${string}`): Promise<string> {
  const client = getPublicClient();
  const balance = await client.getBalance({ address });
  return formatEther(balance);
}

/**
 * Transfer MON from one agent to another (or to platform)
 */
export async function transferMON(
  fromPrivateKey: string,
  toAddress: `0x${string}`,
  amountInMON: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const { client, account } = createAgentWallet(fromPrivateKey);
    
    // Check balance first
    const balance = await checkBalance(account.address);
    if (parseFloat(balance) < parseFloat(amountInMON)) {
      return { success: false, error: `Insufficient balance: ${balance} MON` };
    }
    
    const hash = await client.sendTransaction({
      to: toAddress,
      value: parseEther(amountInMON),
    });
    
    // Wait for confirmation
    const publicClient = getPublicClient();
    await publicClient.waitForTransactionReceipt({ hash });
    
    console.log(`💸 Transferred ${amountInMON} MON to ${toAddress.slice(0, 10)}... (tx: ${hash.slice(0, 10)}...)`);
    
    return { success: true, txHash: hash };
  } catch (error: any) {
    console.error('Transfer failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Fund an agent from the platform wallet
 */
export async function fundAgent(
  agentAddress: `0x${string}`,
  amountInMON: string = '0.1'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const platformKey = process.env.PRIVATE_KEY;
  if (!platformKey) {
    return { success: false, error: 'Platform wallet not configured' };
  }
  
  return transferMON(platformKey, agentAddress, amountInMON);
}

/**
 * Pay entry fee for world (real on-chain transfer)
 */
export async function payWorldEntryFee(
  agentPrivateKey: string,
  worldCreatorAddress: `0x${string}`,
  entryFeeInMON: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  if (parseFloat(entryFeeInMON) === 0) {
    return { success: true }; // Free entry
  }
  return transferMON(agentPrivateKey, worldCreatorAddress, entryFeeInMON);
}

/**
 * Pay arena entry stake (real on-chain transfer to escrow)
 */
export async function payArenaStake(
  agentPrivateKey: string,
  stakeInMON: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  if (parseFloat(stakeInMON) === 0) {
    return { success: true };
  }
  
  // Send to platform wallet as escrow
  const platformKey = process.env.PRIVATE_KEY;
  if (!platformKey) {
    return { success: false, error: 'Platform wallet not configured' };
  }
  
  const { account } = createAgentWallet(platformKey);
  return transferMON(agentPrivateKey, account.address, stakeInMON);
}

/**
 * Pay tournament prize to winner
 */
export async function payTournamentPrize(
  winnerAddress: `0x${string}`,
  prizeInMON: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  return fundAgent(winnerAddress, prizeInMON);
}

/**
 * Pay persuasion incentive
 */
export async function payPersuasionIncentive(
  persuaderPrivateKey: string,
  targetAddress: `0x${string}`,
  incentiveInMON: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  if (parseFloat(incentiveInMON) === 0) {
    return { success: true };
  }
  return transferMON(persuaderPrivateKey, targetAddress, incentiveInMON);
}

/**
 * Request testnet MON from faucet
 */
export async function requestFromFaucet(address: string): Promise<boolean> {
  try {
    const response = await fetch('https://agents.devnads.com/v1/faucet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, chainId: 10143 }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`💧 Faucet sent MON to ${address.slice(0, 10)}... (tx: ${data.txHash?.slice(0, 10)}...)`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Faucet request failed:', error);
    return false;
  }
}
