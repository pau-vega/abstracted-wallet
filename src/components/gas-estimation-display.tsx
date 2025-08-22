import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Fuel, AlertTriangle, Info, Clock } from "lucide-react";
import { formatUnits } from "viem";
import type { GasOption } from "@/hooks/use-gas-estimation";

interface GasEstimationDisplayProps {
  readonly slow: {
    readonly gasLimit: bigint;
    readonly gasPrice: bigint;
    readonly totalCostEth: string;
    readonly totalCostUsd?: string;
    readonly estimatedTime: string;
  };
  readonly standard: {
    readonly gasLimit: bigint;
    readonly gasPrice: bigint;
    readonly totalCostEth: string;
    readonly totalCostUsd?: string;
    readonly estimatedTime: string;
  };
  readonly fast: {
    readonly gasLimit: bigint;
    readonly gasPrice: bigint;
    readonly totalCostEth: string;
    readonly totalCostUsd?: string;
    readonly estimatedTime: string;
  };
  readonly selectedOption: GasOption;
  readonly onOptionChange: (option: GasOption) => void;
  readonly isLoading: boolean;
  readonly error?: Error;
  readonly variant?: "default" | "compact";
}

export const GasEstimationDisplay = ({
  slow,
  standard,
  fast,
  selectedOption,
  onOptionChange,
  isLoading,
  error,
  variant = "default",
}: GasEstimationDisplayProps) => {
  if (error) {
    // Extract the main error message and clean it up
    const errorMessage = error.message;
    let cleanMessage = "Failed to estimate gas";
    let details = "";

    if (errorMessage.includes("insufficient funds")) {
      cleanMessage = "Insufficient funds for gas";
      details = "You don't have enough ETH to pay for the transaction gas fees. Use the faucet below to get test ETH.";
    } else if (errorMessage.includes("execution reverted")) {
      cleanMessage = "Transaction would fail";
      details = "The transaction cannot be executed on the current network.";
    } else if (errorMessage.includes("network")) {
      cleanMessage = "Network error";
      details = "Unable to connect to the network for gas estimation.";
    } else if (errorMessage.includes("gas")) {
      cleanMessage = "Gas estimation failed";
      details = "Unable to calculate gas costs for this transaction.";
    } else {
      cleanMessage = "Gas estimation error";
      details = "An unexpected error occurred while estimating gas costs.";
    }

    return (
      <Card className="mt-2 border-red-200 bg-red-50">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="h-3 w-3 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-red-800 mb-1">{cleanMessage}</h4>
              {details && <p className="text-xs text-red-700 mb-2 leading-relaxed">{details}</p>}
              <details className="text-xs text-red-600">
                <summary className="cursor-pointer hover:text-red-800 font-medium select-none">
                  Technical details
                </summary>
                <div className="mt-1 p-2 bg-red-100 rounded text-xs font-mono break-words max-w-full overflow-hidden">
                  {errorMessage}
                </div>
              </details>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="mt-2">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Fuel className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Estimating gas...</span>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedGas = selectedOption === "slow" ? slow : selectedOption === "fast" ? fast : standard;

  if (variant === "compact") {
    return (
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Fuel className="h-3 w-3" />
          <span>~{parseFloat(selectedGas.totalCostEth).toFixed(6)} ETH</span>
          {selectedGas.totalCostUsd && (
            <>
              <span>•</span>
              <span>${selectedGas.totalCostUsd}</span>
            </>
          )}
        </div>
        <Badge variant="outline" className="text-xs">
          {selectedOption}
        </Badge>
      </div>
    );
  }

  const gasOptions = [
    {
      id: "slow" as const,
      label: "Slow",
      data: slow,
      bgColor: "bg-yellow-50 border-yellow-200",
      iconColor: "text-yellow-600",
    },
    {
      id: "standard" as const,
      label: "Standard",
      data: standard,
      bgColor: "bg-blue-50 border-blue-200",
      iconColor: "text-blue-600",
    },
    {
      id: "fast" as const,
      label: "Fast",
      data: fast,
      bgColor: "bg-green-50 border-green-200",
      iconColor: "text-green-600",
    },
  ];

  return (
    <Card className="mt-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Fuel className="h-4 w-4 text-primary" />
          Gas Settings
          <Badge variant="secondary" className="text-xs">
            <Info className="h-3 w-3 mr-1" />
            Estimate
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <RadioGroup
          value={selectedOption}
          onValueChange={(value) => onOptionChange(value as GasOption)}
          className="space-y-3"
        >
          {gasOptions.map((option) => (
            <div
              key={option.id}
              className={`relative border rounded-lg p-3 cursor-pointer transition-colors ${
                selectedOption === option.id ? option.bgColor : "hover:bg-muted/50"
              }`}
            >
              <Label htmlFor={option.id} className="cursor-pointer">
                <RadioGroupItem value={option.id} id={option.id} className="sr-only" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center ${
                        selectedOption === option.id ? option.iconColor : "text-muted-foreground"
                      }`}
                    >
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{option.label}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {option.data.estimatedTime}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{parseFloat(option.data.totalCostEth).toFixed(6)} ETH</div>
                    {option.data.totalCostUsd && (
                      <div className="text-xs text-muted-foreground">${option.data.totalCostUsd}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatUnits(option.data.gasPrice, 9)} Gwei
                    </div>
                  </div>
                </div>
                {selectedOption === option.id && (
                  <div className="absolute top-2 right-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                  </div>
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {/* Gas limit info */}
        <div className="mt-4 pt-3 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Gas Limit</span>
            <span className="font-mono">{selectedGas.gasLimit.toLocaleString()}</span>
          </div>
        </div>

        {/* High gas warning */}
        {parseFloat(selectedGas.totalCostEth) > 0.01 && (
          <Alert className="mt-3 py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              High gas cost detected. Consider waiting for lower network congestion.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
