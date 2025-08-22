import { useAccount, useBalance, useReadContracts } from "wagmi";
import { erc20Abi, formatUnits } from "viem";
import { sepolia } from "wagmi/chains";

// Common token addresses on Sepolia testnet
export const SEPOLIA_TOKENS = [
  {
    address: "0x7439E9Bb6D8a84dd3A23fe621A30F95403F87fB9" as const,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14" as const,
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
  },
  {
    address: "0x779877A7B0D9E8603169DdbD7836e478b4624789" as const,
    symbol: "LINK",
    name: "Chainlink Token",
    decimals: 18,
  },
  {
    address: "0x2f3A40A3db8a7e3d09B0adfEfbCe4f6F81927557" as const,
    symbol: "UNI",
    name: "Uniswap",
    decimals: 18,
  },
] as const;

export interface TokenBalance {
  readonly address: `0x${string}`;
  readonly symbol: string;
  readonly name: string;
  readonly decimals: number;
  readonly balance: bigint;
  readonly formattedBalance: string;
  readonly isLoading: boolean;
  readonly error: Error | null;
}

export interface UseTokenBalancesReturn {
  readonly ethBalance: {
    readonly balance: bigint;
    readonly formattedBalance: string;
    readonly isLoading: boolean;
    readonly error: Error | null;
  };
  readonly tokenBalances: readonly TokenBalance[];
  readonly isLoading: boolean;
  readonly hasError: boolean;
  readonly refetch: () => void;
}

/**
 * Hook to fetch ETH and ERC20 token balances for the connected account
 */
export const useTokenBalances = (): UseTokenBalancesReturn => {
  const { address } = useAccount();
  
  // Fetch ETH balance
  const {
    data: ethBalanceData,
    isLoading: ethLoading,
    error: ethError,
    refetch: refetchEth,
  } = useBalance({
    address,
    chainId: sepolia.id,
  });

  // Prepare contracts for token balance calls
  const tokenContracts = SEPOLIA_TOKENS.map((token) => ({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf" as const,
    args: [address!],
    chainId: sepolia.id,
  }));

  // Fetch all token balances in parallel
  const {
    data: tokenBalancesData,
    isLoading: tokensLoading,
    error: tokensError,
    refetch: refetchTokens,
  } = useReadContracts({
    contracts: tokenContracts,
    query: {
      enabled: !!address,
    },
  });

  // Process ETH balance
  const ethBalance = {
    balance: ethBalanceData?.value ?? 0n,
    formattedBalance: ethBalanceData?.formatted ?? "0",
    isLoading: ethLoading,
    error: ethError,
  };

  // Process token balances
  const tokenBalances: TokenBalance[] = SEPOLIA_TOKENS.map((token, index) => {
    const result = tokenBalancesData?.[index];
    const balance = result?.status === "success" ? (result.result as bigint) : 0n;
    const error = result?.status === "failure" ? (result.error as Error) : null;

    return {
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      balance,
      formattedBalance: formatUnits(balance, token.decimals),
      isLoading: tokensLoading,
      error,
    };
  });

  const refetch = (): void => {
    refetchEth();
    refetchTokens();
  };

  return {
    ethBalance,
    tokenBalances,
    isLoading: ethLoading || tokensLoading,
    hasError: !!ethError || !!tokensError || tokenBalances.some(token => token.error),
    refetch,
  };
};
