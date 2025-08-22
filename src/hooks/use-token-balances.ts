import { useAccount, useBalance, useReadContracts, useChainId } from "wagmi";
import { erc20Abi, formatUnits } from "viem";

// FUSDT token address
const FUSDT_ADDRESS = "0x118f6C0090ffd227CbeFE1C6d8A803198c4422F0" as const;

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
  readonly fusdtBalance: TokenBalance | null;
  readonly tokenBalances: readonly TokenBalance[]; // Will only contain FUSDT for now
  readonly isLoading: boolean;
  readonly hasError: boolean;
  readonly refetch: () => void;
}

/**
 * Hook to fetch ETH and FUSDT token balances for the connected account
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

  // Fetch FUSDT data (balance and metadata)
  const {
    data: fusdtData,
    isLoading: fusdtLoading,
    error: fusdtError,
    refetch: refetchFusdt,
  } = useReadContracts({
    contracts: [
      {
        address: FUSDT_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address!],
        chainId,
      },
      {
        address: FUSDT_ADDRESS,
        abi: erc20Abi,
        functionName: "name",
        chainId,
      },
      {
        address: FUSDT_ADDRESS,
        abi: erc20Abi,
        functionName: "symbol",
        chainId,
      },
      {
        address: FUSDT_ADDRESS,
        abi: erc20Abi,
        functionName: "decimals",
        chainId,
      },
    ],
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

  // Process FUSDT balance and metadata
  const fusdtBalance: TokenBalance | null = (() => {
    if (!fusdtData) return null;

    const [balanceResult, nameResult, symbolResult, decimalsResult] = fusdtData;

    const balance = balanceResult?.status === "success" ? (balanceResult.result as bigint) : 0n;
    const name = nameResult?.status === "success" ? (nameResult.result as string) : "FUSDT";
    const symbol = symbolResult?.status === "success" ? (symbolResult.result as string) : "FUSDT";
    const decimals = decimalsResult?.status === "success" ? (decimalsResult.result as number) : 18;

    const balanceError = balanceResult?.status === "failure" ? (balanceResult.error as Error) : null;
    const metadataError = [nameResult, symbolResult, decimalsResult].find(
      (result) => result?.status === "failure"
    )?.error as Error | undefined;

    return {
      address: FUSDT_ADDRESS,
      symbol,
      name,
      decimals,
      balance,
      formattedBalance: formatUnits(balance, decimals),
      isLoading: fusdtLoading,
      error: balanceError || metadataError || null,
    };
  })();

  // For backward compatibility, return FUSDT in tokenBalances array
  const tokenBalances: TokenBalance[] = fusdtBalance ? [fusdtBalance] : [];

  const refetch = (): void => {
    refetchEth();
    refetchFusdt();
  };

  return {
    ethBalance,
    fusdtBalance,
    tokenBalances,
    isLoading: ethLoading || fusdtLoading,
    hasError: !!ethError || !!fusdtError || !!fusdtBalance?.error,
    refetch,
  };
};
