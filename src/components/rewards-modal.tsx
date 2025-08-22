import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { USDT_ABI } from "@/constants";

interface RewardsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

const TOKEN_CONTRACT = "0x118f6c0090ffd227cbefe1c6d8a803198c4422f0" as const;
const MINT_AMOUNT = 1n * 10n ** 18n; // Start with 1 token to test

export function RewardsModal({ isOpen, onClose }: RewardsModalProps) {
  const { address } = useAccount();

  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const handleMint = async (): Promise<void> => {
    if (!address) {
      console.error("No wallet address found");
      return;
    }

    try {
      console.log("Starting mint process for address:", address);
      console.log("Mint amount:", MINT_AMOUNT.toString());

      writeContract(
        {
          address: TOKEN_CONTRACT,
          abi: USDT_ABI,
          functionName: "mint",
          args: [address, MINT_AMOUNT],
        },
        {
          onError: (error) => {
            console.error("Failed to mint tokens:", error);
            console.error("Error details:", {
              message: error.message,
              cause: error.cause,
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

    return {
      icon: <Gift className="h-8 w-8 text-blue-500" />,
      title: "Claim Your Rewards",
      description: "Mint 100 tokens to your wallet as a reward for using our app!",
      buttonText: "Mint 100 Tokens",
      buttonVariant: "default" as const,
      onButtonClick: handleMint,
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
                {TOKEN_CONTRACT.slice(0, 6)}...{TOKEN_CONTRACT.slice(-4)}
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
