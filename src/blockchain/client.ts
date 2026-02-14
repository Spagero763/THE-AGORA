/**
 * THE AGORA - Blockchain Client
 * Viem client setup for Monad interactions
 */

import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getMonadChain, getNetworkConfig } from '../config/network.js';

let publicClient: ReturnType<typeof createPublicClient> | null = null;
let walletClient: ReturnType<typeof createWalletClient> | null = null;
let account: ReturnType<typeof privateKeyToAccount> | null = null;

/**
 * Initialize blockchain clients
 */
export function initializeClients(privateKey?: string) {
  const chain = getMonadChain();
  const config = getNetworkConfig();

  // Public client for reading blockchain data
  publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  // Wallet client for sending transactions (if private key provided)
  if (privateKey) {
    const formattedKey = (privateKey.startsWith('0x') 
      ? privateKey
      : `0x${privateKey}`) as `0x${string}`;
    
    account = privateKeyToAccount(formattedKey);
    
    walletClient = createWalletClient({
      account,
      chain,
      transport: http(config.rpcUrl),
    });
  }

  return { publicClient, walletClient, account };
}

/**
 * Get public client (creates one if not initialized)
 */
export function getPublicClient() {
  if (!publicClient) {
    initializeClients();
  }
  return publicClient!;
}

/**
 * Get wallet client (requires initialization with private key)
 */
export function getWalletClient() {
  if (!walletClient) {
    throw new Error('Wallet client not initialized. Call initializeClients(privateKey) first.');
  }
  return walletClient;
}

/**
 * Get the account (requires initialization with private key)
 */
export function getAccount() {
  if (!account) {
    throw new Error('Account not initialized. Call initializeClients(privateKey) first.');
  }
  return account;
}

/**
 * Get MON balance for an address
 */
export async function getBalance(address: `0x${string}`): Promise<string> {
  const client = getPublicClient();
  const balance = await client.getBalance({ address });
  return formatEther(balance);
}

/**
 * Send MON to an address
 */
export async function sendMON(
  to: `0x${string}`,
  amountInMON: string
): Promise<`0x${string}`> {
  const wallet = getWalletClient();
  const chain = getMonadChain();
  const acc = getAccount();
  
  const hash = await wallet.sendTransaction({
    account: acc,
    to,
    value: parseEther(amountInMON),
    chain,
  });
  
  return hash;
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(hash: `0x${string}`) {
  const client = getPublicClient();
  return client.waitForTransactionReceipt({ hash });
}

/**
 * Get current block number
 */
export async function getBlockNumber(): Promise<bigint> {
  const client = getPublicClient();
  return client.getBlockNumber();
}

/**
 * Request testnet MON from faucet
 */
export async function requestTestnetMON(address: string): Promise<boolean> {
  const config = getNetworkConfig();
  
  if (!config.faucetUrl) {
    console.log('Faucet only available on testnet');
    return false;
  }

  try {
    const response = await fetch(config.faucetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });

    if (response.ok) {
      console.log(`Requested testnet MON for ${address}`);
      return true;
    } else {
      const error = await response.text();
      console.log(`Faucet error: ${error}`);
      return false;
    }
  } catch (error) {
    console.error('Faucet request failed:', error);
    return false;
  }
}
