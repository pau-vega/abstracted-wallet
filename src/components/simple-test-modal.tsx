import { useSendTransaction, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { parseEther } from "viem";

interface SimpleTestModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function SimpleTestModal({ isOpen, onClose }: SimpleTestModalProps) {
  const { address } = useAccount();

  const { sendTransaction, data: hash, error, isPending } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const handleTest = async (): Promise<void> => {
    if (!address) {
      console.error("No wallet address found");
      return;
    }

    try {
      console.log("Starting simple transaction test for address:", address);

      // Send a tiny amount of ETH to self (0.001 ETH)
      sendTransaction({
        to: address,
        value: parseEther("0.001"),
        data: "0x", // Required by passkeys connector for all transactions
      });
    } catch (err) {
      console.log("err", err);
      console.error("Failed to send test transaction:", err);
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
        title: "Test Failed",
        description: error.message || "There was an error with the test transaction. Please try again.",
        buttonText: "Try Again",
        buttonVariant: "destructive" as const,
        onButtonClick: handleTest,
      };
    }

    if (isConfirmed) {
      return {
        icon: <CheckCircle className="h-8 w-8 text-green-500" />,
        title: "Test Successful!",
        description: "Your ZeroDev smart account is working correctly!",
        buttonText: "Close",
        buttonVariant: "default" as const,
        onButtonClick: handleClose,
      };
    }

    if (isPending || isConfirming) {
      return {
        icon: <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />,
        title: isPending ? "Confirming Transaction..." : "Processing...",
        description: isPending ? "Please confirm the transaction." : "Your test transaction is being processed.",
        buttonText: "Please Wait",
        buttonVariant: "secondary" as const,
        onButtonClick: () => {},
        disabled: true,
      };
    }

    return {
      icon: <Gift className="h-8 w-8 text-blue-500" />,
      title: "Test Your Smart Account",
      description: "Send a small test transaction to verify your ZeroDev setup is working.",
      buttonText: "Run Test Transaction",
      buttonVariant: "default" as const,
      onButtonClick: handleTest,
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
              <span className="text-sm font-medium">Test Type</span>
              <Badge variant="secondary" className="font-mono text-xs">
                Self Transfer
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Amount</span>
              <Badge variant="outline">0.001 ETH</Badge>
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
