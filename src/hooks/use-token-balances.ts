import { useAccount, useBalance, useReadContracts, useChainId } from "wagmi";
import { erc20Abi, formatUnits } from "viem";

/**
 * Tokens to load balances for
 * 
 * To add a new token:
 * 1. Add the token contract address to this array
 * 2. The hook will automatically fetch name, symbol, decimals, and balance from the contract
 * 
 * Example:
 * const TOKENS_TO_LOAD = [
 *   "0x118f6C0090ffd227CbeFE1C6d8A803198c4422F0", // FUSDT
 *   "0xA0b86a33E6441e4A52B3A8E0B80F4b9b1b6C8F2D", // Your new token
 * ] as const;
 */
const TOKENS_TO_LOAD = [
  "0x118f6C0090ffd227CbeFE1C6d8A803198c4422F0", // FUSDT
  // Add more token addresses here as needed
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
  readonly tokenBalances: readonly TokenBalance[]; // Array of all loaded tokens (currently just FUSDT)
  readonly isLoading: boolean;
  readonly hasError: boolean;
  readonly refetch: () => void;
}

/**
 * Hook to fetch ETH and ERC20 token balances for the connected account
 */
export const useTokenBalances = (): UseTokenBalancesReturn => {
  const { address } = useAccount();
  const chainId = useChainId();

  // Fetch ETH balance
  const {
    data: ethBalanceData,
    isLoading: ethLoading,
    error: ethError,
    refetch: refetchEth,
  } = useBalance({
    address,
    chainId,
  });

  // Create contracts for all tokens (balance + metadata for each)
  const tokenContracts = TOKENS_TO_LOAD.flatMap((tokenAddress) => [
    {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [address!],
      chainId,
    },
    {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "name" as const,
      chainId,
    },
    {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "symbol" as const,
      chainId,
    },
    {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "decimals" as const,
      chainId,
    },
  ]);

  // Fetch all token data
  const {
    data: tokenData,
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

  // Process token balances and metadata
  const tokenBalances: TokenBalance[] = TOKENS_TO_LOAD.map((tokenAddress, index) => {
    if (!tokenData) {
      return {
        address: tokenAddress,
        symbol: "Unknown",
        name: "Unknown Token",
        decimals: 18,
        balance: 0n,
        formattedBalance: "0",
        isLoading: tokensLoading,
        error: null,
      };
    }

    // Each token has 4 contract calls: balance, name, symbol, decimals
    const dataStartIndex = index * 4;
    const balanceResult = tokenData[dataStartIndex];
    const nameResult = tokenData[dataStartIndex + 1];
    const symbolResult = tokenData[dataStartIndex + 2];
    const decimalsResult = tokenData[dataStartIndex + 3];

    const balance = balanceResult?.status === "success" ? (balanceResult.result as bigint) : 0n;
    const name = nameResult?.status === "success" ? (nameResult.result as string) : "Unknown Token";
    const symbol = symbolResult?.status === "success" ? (symbolResult.result as string) : "Unknown";
    const decimals = decimalsResult?.status === "success" ? (decimalsResult.result as number) : 18;

    const balanceError = balanceResult?.status === "failure" ? (balanceResult.error as Error) : null;
    const metadataError = [nameResult, symbolResult, decimalsResult].find(
      (result) => result?.status === "failure"
    )?.error as Error | undefined;

    return {
      address: tokenAddress,
      symbol,
      name,
      decimals,
      balance,
      formattedBalance: formatUnits(balance, decimals),
      isLoading: tokensLoading,
      error: balanceError || metadataError || null,
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
    hasError: !!ethError || !!tokensError || tokenBalances.some((token) => token.error),
    refetch,
  };
};
