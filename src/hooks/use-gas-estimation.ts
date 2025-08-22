import { useState, useEffect } from "react";
import { useAccount, useEstimateGas, useGasPrice, useEstimateFeesPerGas } from "wagmi";
import { formatUnits, parseEther, encodeFunctionData, erc20Abi, parseUnits } from "viem";
import type { Address } from "viem";

export type GasOption = "slow" | "standard" | "fast";

interface GasSettings {
  readonly gasLimit: bigint;
  readonly gasPrice: bigint;
  readonly maxFeePerGas?: bigint;
  readonly maxPriorityFeePerGas?: bigint;
  readonly totalCostWei: bigint;
  readonly totalCostEth: string;
  readonly totalCostUsd?: string;
  readonly estimatedTime: string;
}

interface GasEstimation {
  readonly slow: GasSettings;
  readonly standard: GasSettings;
  readonly fast: GasSettings;
  readonly selectedOption: GasOption;
  readonly setSelectedOption: (option: GasOption) => void;
  readonly selected: GasSettings;
  readonly isLoading: boolean;
  readonly error?: Error;
}

interface UseGasEstimationParams {
  readonly to?: Address;
  readonly value?: bigint;
  readonly data?: `0x${string}`;
  readonly enabled?: boolean;
}

/**
 * Hook to estimate gas for transactions with multiple speed options
 */
export const useGasEstimation = (params: UseGasEstimationParams): GasEstimation => {
  const { address } = useAccount();
  const [selectedOption, setSelectedOption] = useState<GasOption>("standard");
  const [ethPriceUsd, setEthPriceUsd] = useState<number | undefined>();

  // Estimate gas limit
  const {
    data: gasLimit,
    isLoading: isEstimatingGas,
    error: gasError,
  } = useEstimateGas({
    to: params.to,
    value: params.value || 0n,
    data: params.data,
    account: address,
    query: {
      enabled: params.enabled && !!params.to && !!address,
    },
  });

  // Get EIP-1559 fee data (preferred for modern chains)
  const { data: feeData, isLoading: isLoadingFeeData } = useEstimateFeesPerGas({
    query: {
      enabled: params.enabled,
    },
  });

  // Fallback to legacy gas price
  const { data: legacyGasPrice, isLoading: isLoadingGasPrice } = useGasPrice({
    query: {
      enabled: params.enabled && !feeData,
    },
  });

  // Fetch ETH price
  useEffect(() => {
    if (!params.enabled) return;

    const fetchEthPrice = async (): Promise<void> => {
      try {
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
        const data = await response.json();
        setEthPriceUsd(data.ethereum?.usd);
      } catch (error) {
        console.warn("Failed to fetch ETH price:", error);
      }
    };

    fetchEthPrice();
  }, [params.enabled]);

  // Calculate gas options
  const createGasSettings = (multiplier: number, estimatedTime: string): GasSettings => {
    const limit = gasLimit || 21000n;

    let gasPrice: bigint;
    let maxFeePerGas: bigint | undefined;
    let maxPriorityFeePerGas: bigint | undefined;

    if (feeData?.maxFeePerGas && feeData?.maxPriorityFeePerGas) {
      // EIP-1559 transaction
      maxFeePerGas = BigInt(Math.floor(Number(feeData.maxFeePerGas) * multiplier));
      maxPriorityFeePerGas = BigInt(Math.floor(Number(feeData.maxPriorityFeePerGas) * multiplier));
      gasPrice = maxFeePerGas; // For cost calculation
    } else if (legacyGasPrice) {
      // Legacy transaction
      gasPrice = BigInt(Math.floor(Number(legacyGasPrice) * multiplier));
    } else {
      // Fallback
      gasPrice = BigInt(Math.floor(20_000_000_000 * multiplier)); // 20 gwei
    }

    const totalCostWei = limit * gasPrice;
    const totalCostEth = formatUnits(totalCostWei, 18);
    const totalCostUsd = ethPriceUsd ? (parseFloat(totalCostEth) * ethPriceUsd).toFixed(2) : undefined;

    return {
      gasLimit: limit,
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
      totalCostWei,
      totalCostEth,
      totalCostUsd,
      estimatedTime,
    };
  };

  const slow = createGasSettings(0.9, "~5 min");
  const standard = createGasSettings(1.0, "~1 min");
  const fast = createGasSettings(1.2, "~15 sec");

  const selected = selectedOption === "slow" ? slow : selectedOption === "fast" ? fast : standard;

  return {
    slow,
    standard,
    fast,
    selectedOption,
    setSelectedOption,
    selected,
    isLoading: isEstimatingGas || isLoadingFeeData || isLoadingGasPrice,
    error: gasError || undefined,
  };
};

/**
 * Hook specifically for FUSDT transfer gas estimation
 */
export const useFusdtTransferGasEstimation = (to?: Address, amount?: string, enabled = false): GasEstimation => {
  const fusdtAddress = "0x118f6c0090ffd227cbefe1c6d8a803198c4422f0" as const;

  const data =
    to && amount
      ? encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [to, parseUnits(amount, 18)], // FUSDT has 18 decimals
        })
      : undefined;

  return useGasEstimation({
    to: fusdtAddress,
    value: 0n, // No ETH value for ERC20 transfer
    data,
    enabled: enabled && !!to && !!amount,
  });
};

/**
 * Hook specifically for ETH transfer gas estimation
 */
export const useEthTransferGasEstimation = (to?: Address, amount?: string, enabled = false): GasEstimation => {
  const value = amount ? parseEther(amount) : undefined;

  return useGasEstimation({
    to,
    value,
    enabled: enabled && !!to && !!amount,
  });
};
