/**
 * THE AGORA - Network Configuration
 * Monad blockchain settings for testnet and mainnet
 */

export type NetworkType = 'testnet' | 'mainnet';

export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  faucetUrl?: string;
}

export const NETWORKS: Record<NetworkType, NetworkConfig> = {
  testnet: {
    chainId: 10143,
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    faucetUrl: 'https://agents.devnads.com/v1/faucet',
  },
  mainnet: {
    chainId: 143,
    rpcUrl: 'https://rpc.monad.xyz',
  },
};

export function getNetworkConfig(): NetworkConfig {
  const network = (process.env.NETWORK || 'mainnet') as NetworkType;
  return NETWORKS[network];
}

// Monad chain definition for Viem
export function getMonadChain() {
  const config = getNetworkConfig();
  return {
    id: config.chainId,
    name: config.chainId === 143 ? 'Monad' : 'Monad Testnet',
    nativeCurrency: {
      name: 'MON',
      symbol: 'MON',
      decimals: 18,
    },
    rpcUrls: {
      default: { http: [config.rpcUrl] },
    },
    blockExplorers: {
      default: {
        name: 'MonadVision',
        url: config.chainId === 143 
          ? 'https://monadvision.com' 
          : 'https://testnet.monadvision.com',
      },
    },
  } as const;
}
