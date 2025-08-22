import { useAccount, useBalance, useReadContracts, useChainId } from "wagmi";
import { erc20Abi, formatUnits } from "viem";
import { sepolia, polygonAmoy } from "wagmi/chains";

/**
 * Network-specific tokens to load balances for
 *
 * To add a new token:
 * 1. Add the token contract address to the appropriate network object
 * 2. The hook will automatically fetch name, symbol, decimals, and balance from the contract
 *
 * Example:
 * const NETWORK_TOKENS = {
 *   [sepolia.id]: [
 *     "0x118f6C0090ffd227CbeFE1C6d8A803198c4422F0", // FUSDT on Sepolia
 *     "0xYourNewTokenAddressOnSepolia",
 *   ],
 *   [polygonAmoy.id]: [
 *     "0xPolygonAmoyFUSDTAddress", // FUSDT on Polygon Amoy
 *     "0xYourNewTokenAddressOnPolygonAmoy",
 *   ],
 * } as const;
 */
const NETWORK_TOKENS = {
  [sepolia.id]: [
    "0x118f6C0090ffd227CbeFE1C6d8A803198c4422F0", // FUSDT on Sepolia
    // Add more Sepolia tokens here
  ],
  [polygonAmoy.id]: [
    "0x783904e158200811A97A73FD58DcE024c44e125B", // Token on Polygon Amoy
    // TODO: Add more token contract addresses for Polygon Amoy testnet
    // You can either:
    // 1. Deploy your own FUSDT contract on Polygon Amoy
    // 2. Find existing test tokens on Polygon Amoy testnet
    // 3. Use different test tokens available on Polygon Amoy
    // Example: "0xYourFUSDTContractOnPolygonAmoy",
  ],
} as const;

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
  readonly tokenBalances: readonly TokenBalance[]; // Array of all loaded tokens for the current network
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

  // Get tokens for the current network
  const tokensToLoad = NETWORK_TOKENS[chainId as keyof typeof NETWORK_TOKENS] || [];

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
  const tokenContracts = tokensToLoad.flatMap((tokenAddress) => [
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
  const tokenBalances: TokenBalance[] = tokensToLoad.map((tokenAddress, index) => {
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
    const metadataError = [nameResult, symbolResult, decimalsResult].find((result) => result?.status === "failure")
      ?.error as Error | undefined;

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
