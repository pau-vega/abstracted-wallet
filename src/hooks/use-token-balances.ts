import { useAccount, useBalance, useReadContracts } from "wagmi";
import { erc20Abi, formatUnits } from "viem";
import { sepolia } from "wagmi/chains";

// Popular tokens available on Sepolia (treating it as our main network)
export const SEPOLIA_TOKENS = [
  {
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as const,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    address: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0" as const,
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  {
    address: "0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6" as const,
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
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
    name: "Chainlink",
    decimals: 18,
  },
  {
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" as const,
    symbol: "UNI",
    name: "Uniswap",
    decimals: 18,
  },
  {
    address: "0x68194a729C2450ad26072b3D33ADaCbcef39D574" as const,
    symbol: "MATIC",
    name: "Polygon",
    decimals: 18,
  },
  {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as const,
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
  },
  {
    address: "0x118f6c0090ffd227cbefe1c6d8a803198c4422f0" as const,
    symbol: "RWT", // Will be updated with real symbol from contract
    name: "Reward Token", // Will be updated with real name from contract  
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

  // Prepare contracts to fetch metadata for the rewards token (to get real name/symbol)
  const rewardsTokenAddress = "0x118f6c0090ffd227cbefe1c6d8a803198c4422f0" as const;
  const rewardsTokenMetadataContracts = [
    {
      address: rewardsTokenAddress,
      abi: erc20Abi,
      functionName: "name" as const,
      chainId: sepolia.id,
    },
    {
      address: rewardsTokenAddress,
      abi: erc20Abi,
      functionName: "symbol" as const,
      chainId: sepolia.id,
    },
    {
      address: rewardsTokenAddress,
      abi: erc20Abi,
      functionName: "decimals" as const,
      chainId: sepolia.id,
    },
  ];

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

  // Fetch rewards token metadata
  const {
    data: rewardsTokenMetadata,
    isLoading: metadataLoading,
    refetch: refetchMetadata,
  } = useReadContracts({
    contracts: rewardsTokenMetadataContracts,
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

  // Extract real rewards token metadata
  const rewardsTokenName = rewardsTokenMetadata?.[0]?.status === "success" 
    ? (rewardsTokenMetadata[0].result as string) 
    : "Reward Token";
  const rewardsTokenSymbol = rewardsTokenMetadata?.[1]?.status === "success" 
    ? (rewardsTokenMetadata[1].result as string) 
    : "RWT";
  const rewardsTokenDecimals = rewardsTokenMetadata?.[2]?.status === "success" 
    ? (rewardsTokenMetadata[2].result as number) 
    : 18;

  // Process token balances
  const tokenBalances: TokenBalance[] = SEPOLIA_TOKENS.map((token, index) => {
    const result = tokenBalancesData?.[index];
    const balance = result?.status === "success" ? (result.result as bigint) : 0n;
    const error = result?.status === "failure" ? (result.error as Error) : null;

    // Use real metadata for rewards token
    const isRewardsToken = token.address === rewardsTokenAddress;
    const tokenSymbol = isRewardsToken ? rewardsTokenSymbol : token.symbol;
    const tokenName = isRewardsToken ? rewardsTokenName : token.name;
    const tokenDecimals = isRewardsToken ? rewardsTokenDecimals : token.decimals;

    return {
      address: token.address,
      symbol: tokenSymbol,
      name: tokenName,
      decimals: tokenDecimals,
      balance,
      formattedBalance: formatUnits(balance, tokenDecimals),
      isLoading: tokensLoading || (isRewardsToken && metadataLoading),
      error,
    };
  });

  const refetch = (): void => {
    refetchEth();
    refetchTokens();
    refetchMetadata();
  };

  return {
    ethBalance,
    tokenBalances,
    isLoading: ethLoading || tokensLoading || metadataLoading,
    hasError: !!ethError || !!tokensError || tokenBalances.some(token => token.error),
    refetch,
  };
};
