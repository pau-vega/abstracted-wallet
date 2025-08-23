import { useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract, useChainId } from "wagmi";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Loader2, CheckCircle, AlertCircle, ExternalLink, Copy } from "lucide-react";
import { USDT_ABI } from "@/constants";
import { erc20Abi, parseUnits, encodeFunctionData } from "viem";
import { sepolia, polygonAmoy } from "wagmi/chains";
import { useGasEstimation } from "@/hooks/use-gas-estimation";
import { GasEstimationDisplay } from "@/components/gas-estimation-display";
import { openExplorerLink } from "@/utils/explorer-links";
import { useState } from "react";

interface RewardsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

// Network-specific token contract addresses
const NETWORK_TOKEN_CONTRACTS = {
  [sepolia.id]: "0x118f6c0090ffd227cbefe1c6d8a803198c4422f0" as const, // FUSDT on Sepolia
  [polygonAmoy.id]: "0x783904e158200811A97A73FD58DcE024c44e125B" as const, // Token on Polygon Amoy
} as const;

export function RewardsModal({ isOpen, onClose }: RewardsModalProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const [copied, setCopied] = useState(false);

  // Get the token contract for the current network
  const tokenContract = NETWORK_TOKEN_CONTRACTS[chainId as keyof typeof NETWORK_TOKEN_CONTRACTS];

  // Read the token decimals from the contract
  const { data: tokenDecimals } = useReadContract({
    address: tokenContract || undefined,
    abi: erc20Abi,
    functionName: "decimals",
    query: {
      enabled: !!tokenContract, // Only fetch if token contract exists for this network
    },
  });

  // Prepare mint transaction data for gas estimation
  const mintAmount = tokenDecimals ? parseUnits("100", tokenDecimals) : undefined;
  const mintData =
    address && mintAmount
      ? encodeFunctionData({
          abi: USDT_ABI,
          functionName: "mint",
          args: [address, mintAmount],
        })
      : undefined;

  // Estimate gas for the mint operation
  const gasEstimation = useGasEstimation({
    to: tokenContract,
    data: mintData,
    enabled: !!tokenContract && !!address && !!tokenDecimals,
  });

  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const handleMint = async (): Promise<void> => {
    if (!address) {
      console.error("No wallet address found");
      return;
    }

    if (!tokenContract) {
      console.error("No token contract available for this network");
      return;
    }

    if (!tokenDecimals) {
      console.error("Token decimals not loaded yet");
      return;
    }

    try {
      // Calculate the correct mint amount using actual decimals from contract
      const mintAmount = parseUnits("100", tokenDecimals);
      console.log("Starting mint process for address:", address);
      console.log("Token decimals:", tokenDecimals);
      console.log("Mint amount:", mintAmount.toString(), "(100 tokens)");

      const gasParams = gasEstimation.selected.maxFeePerGas
        ? {
            gas: gasEstimation.selected.gasLimit,
            maxFeePerGas: gasEstimation.selected.maxFeePerGas,
            maxPriorityFeePerGas: gasEstimation.selected.maxPriorityFeePerGas,
          }
        : {
            gas: gasEstimation.selected.gasLimit,
            gasPrice: gasEstimation.selected.gasPrice,
          };

      writeContract(
        {
          address: tokenContract,
          abi: USDT_ABI,
          functionName: "mint",
          args: [address, mintAmount],
          ...gasParams,
        },
        {
          onError: (error) => {
            console.error("Failed to mint tokens:", error);
            console.error("Error details:", {
              message: error.message,
              name: error.name,
            });
          },
          onSuccess: (data) => {
            console.log("Mint transaction successful:", data);
          },
        },
      );
    } catch (err) {
      console.error("Failed to mint tokens:", err);
    }
  };

  const copyToClipboard = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleClose = (): void => {
    if (!isPending && !isConfirming) {
      onClose();
    }
  };

  const getStatusContent = () => {
    if (error) {
      return {
        icon: <AlertCircle className="h-8 w-8 text-red-500" />,
        title: "Minting Failed",
        description: "There was an error minting your tokens. Please try again.",
        buttonText: "Try Again",
        buttonVariant: "destructive" as const,
      };
    }

    if (isConfirmed) {
      return {
        icon: <CheckCircle className="h-8 w-8 text-green-500" />,
        title: "Tokens Minted Successfully!",
        description: "100 tokens have been added to your wallet.",
        buttonText: "Close",
        buttonVariant: "default" as const,
        onButtonClick: handleClose,
      };
    }

    if (isPending || isConfirming) {
      return {
        icon: <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />,
        title: isPending ? "Confirming Transaction..." : "Minting Tokens...",
        description: isPending
          ? "Please confirm the transaction in your wallet."
          : "Your tokens are being minted. This may take a few moments.",
        buttonText: "Please Wait",
        buttonVariant: "secondary" as const,
        onButtonClick: () => {},
        disabled: true,
      };
    }

    if (!tokenContract) {
      return {
        icon: <AlertCircle className="h-8 w-8 text-amber-500" />,
        title: "Rewards Not Available",
        description:
          "Token rewards are not available on this network. Switch to Sepolia or Polygon Amoy to claim tokens.",
        buttonText: "Switch to Sepolia",
        buttonVariant: "secondary" as const,
        onButtonClick: () => {}, // Could add chain switch functionality here
        disabled: true,
      };
    }

    return {
      icon: <Gift className="h-8 w-8 text-blue-500" />,
      title: "Claim Your Rewards",
      description: "Mint 100 tokens to your wallet as a reward for using our app!",
      buttonText: tokenDecimals ? "Mint 100 Tokens" : "Loading...",
      buttonVariant: "default" as const,
      onButtonClick: handleMint,
      disabled: !tokenDecimals,
    };
  };

  const status = getStatusContent();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            {status.icon}
          </div>
          <DialogTitle className="text-xl font-bold">{status.title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{status.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Token Contract</span>
              <div className="flex items-center gap-2">
                {tokenContract && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openExplorerLink(chainId, "token", tokenContract)}
                    className="h-6 w-6 p-0"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
                <Badge variant="secondary" className="font-mono text-xs">
                  {tokenContract ? `${tokenContract.slice(0, 6)}...${tokenContract.slice(-4)}` : "N/A"}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Amount</span>
              <Badge variant="outline">100 Tokens</Badge>
            </div>
          </div>

          {/* Gas Estimation Display */}
          {tokenContract && address && tokenDecimals && !isPending && !isConfirming && !isConfirmed && (
            <GasEstimationDisplay
              slow={gasEstimation.slow}
              standard={gasEstimation.standard}
              fast={gasEstimation.fast}
              selectedOption={gasEstimation.selectedOption}
              onOptionChange={gasEstimation.setSelectedOption}
              isLoading={gasEstimation.isLoading}
              error={gasEstimation.error}
              variant="default"
            />
          )}

          {/* Faucet Link for Test ETH */}
          {tokenContract && address && !isPending && !isConfirming && !isConfirmed && (
            <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-blue-100 dark:bg-blue-800/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">?</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                    Don't have ETH for gas? Get free test ETH for testing.
                  </p>
                  <a
                    href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline"
                  >
                    <span>Google Cloud Sepolia Faucet</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={status.onButtonClick}
            disabled={status.disabled}
            variant={status.buttonVariant}
            size="lg"
            className="w-full"
          >
            {(isPending || isConfirming) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {status.buttonText}
          </Button>

          {!isConfirmed && !error && (
            <Button variant="ghost" onClick={handleClose} className="w-full">
              Cancel
            </Button>
          )}
        </div>

        {hash && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Transaction Hash:</p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openExplorerLink(chainId, "tx", hash)}
                  className="h-6 w-6 p-0"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(hash)} className="h-6 w-6 p-0">
                  {copied ? <CheckCircle className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
            <p className="font-mono text-xs break-all">{hash}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
