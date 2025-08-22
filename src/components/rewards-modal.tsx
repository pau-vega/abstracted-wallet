import { useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract, useChainId } from "wagmi";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { USDT_ABI } from "@/constants";
import { erc20Abi, parseUnits } from "viem";
import { sepolia, polygonAmoy } from "wagmi/chains";

interface RewardsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

// Network-specific token contract addresses
const NETWORK_TOKEN_CONTRACTS = {
  [sepolia.id]: "0x118f6c0090ffd227cbefe1c6d8a803198c4422f0" as const, // FUSDT on Sepolia
  [polygonAmoy.id]: "0xb23a245be0517938aed10a95cc8d7300a7d93db1" as const, // Token on Polygon Amoy
} as const;

export function RewardsModal({ isOpen, onClose }: RewardsModalProps) {
  const { address } = useAccount();
  const chainId = useChainId();

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

      writeContract(
        {
          address: tokenContract,
          abi: USDT_ABI,
          functionName: "mint",
          args: [address, mintAmount],
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
        description: "Token rewards are not available on this network. Switch to Sepolia or Polygon Amoy to claim tokens.",
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
          <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
            {status.icon}
          </div>
          <DialogTitle className="text-xl font-bold">{status.title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{status.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Token Contract</span>
              <Badge variant="secondary" className="font-mono text-xs">
                {tokenContract ? `${tokenContract.slice(0, 6)}...${tokenContract.slice(-4)}` : "N/A"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Amount</span>
              <Badge variant="outline">100 Tokens</Badge>
            </div>
          </div>

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
            <p className="text-xs text-muted-foreground">Transaction Hash:</p>
            <p className="font-mono text-xs break-all">{hash}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
