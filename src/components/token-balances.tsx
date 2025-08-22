import { useTokenBalances, type TokenBalance } from "@/hooks/use-token-balances";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Coins, RefreshCw, TrendingUp, AlertCircle, Wallet } from "lucide-react";
import { useState } from "react";

interface TokenBalanceItemProps {
  readonly token: TokenBalance;
  readonly isEth?: boolean;
}

/**
 * Formats a balance number for display with appropriate precision and large number formatting
 */
const formatBalanceDisplay = (formattedBalance: string): { display: string; exact: string } => {
  const balance = parseFloat(formattedBalance);
  const exact = balance.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });

  if (balance === 0) return { display: "0.0000", exact };
  if (balance < 0.001) return { display: "< 0.001", exact };

  // For very large numbers, use more intuitive compact format
  if (balance >= 1e15) {
    // Quadrillion range
    return {
      display: `${(balance / 1e15).toFixed(2)}Q`,
      exact,
    };
  }

  if (balance >= 1e12) {
    // Trillion range
    return {
      display: `${(balance / 1e12).toFixed(2)}T`,
      exact,
    };
  }

  if (balance >= 1e9) {
    // Billion range
    return {
      display: `${(balance / 1e9).toFixed(2)}B`,
      exact,
    };
  }

  if (balance >= 1e6) {
    // Million range
    return {
      display: `${(balance / 1e6).toFixed(2)}M`,
      exact,
    };
  }

  if (balance >= 1e3) {
    // Thousand range - use comma separators instead of K for better readability
    return {
      display: balance.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      exact,
    };
  }

  // For smaller numbers, show more precision with comma separators
  return {
    display: balance.toLocaleString("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }),
    exact,
  };
};

const TokenBalanceItem = ({ token, isEth = false }: TokenBalanceItemProps) => {
  const hasBalance = token.balance > 0n;
  // Note: Removed isRewardsToken logic - treat all tokens as regular tokens

  const { display: formattedDisplay, exact: exactValue } = formatBalanceDisplay(token.formattedBalance);

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center space-x-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isEth ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
          }`}
        >
          {isEth ? <span className="text-xs font-bold">ETH</span> : <Coins className="h-4 w-4" />}
        </div>

        <div>
          <div className="flex items-center space-x-2">
            <span className="font-medium">{token.symbol}</span>
            {hasBalance && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                <TrendingUp className="h-3 w-3 mr-1" />
                Active
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{token.name}</p>
        </div>
      </div>

      <div className="text-right">
        {token.isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : token.error ? (
          <div className="text-right">
            <span className="text-sm text-destructive">Error</span>
            <p className="text-xs text-muted-foreground" title={token.error.message}>
              Failed to load
            </p>
          </div>
        ) : (
          <div>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className={`font-mono text-sm ${hasBalance ? "font-medium" : "text-muted-foreground"} cursor-help`}>
                  {formattedDisplay}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-mono">
                  {exactValue} {token.symbol}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Exact value</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-xs text-muted-foreground">{token.symbol}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export const TokenBalances = () => {
  const { ethBalance, tokenBalances, isLoading, hasError, refetch } = useTokenBalances();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    refetch();
    // Add a small delay for better UX
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Filter to only show tokens with balance > 0
  const tokensWithBalance = tokenBalances.filter((token) => token.balance > 0n);
  const hasEthBalance = ethBalance.balance > 0n;
  
  // Always show ETH (even with zero balance) but only show tokens with balance > 0
  const totalTokenCount = tokensWithBalance.length + 1; // +1 for ETH

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center space-x-2">
            <Wallet className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Token Balances</CardTitle>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {tokensWithBalance.length > 0
                ? `${totalTokenCount} tokens`
                : "1 token"}
            </Badge>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {hasError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load some token balances. Try refreshing or check your connection.
              </AlertDescription>
            </Alert>
          )}

          {/* ETH Balance - always show */}
          <TokenBalanceItem
            token={{
              address: "0x0000000000000000000000000000000000000000" as const,
              symbol: "ETH",
              name: "Ethereum",
              decimals: 18,
              balance: ethBalance.balance,
              formattedBalance: ethBalance.formattedBalance,
              isLoading: ethBalance.isLoading,
              error: ethBalance.error,
            }}
            isEth={true}
          />

          {/* Token Balances - only show tokens with balance > 0 */}
          {tokensWithBalance.length > 0 && (
            <div className="space-y-2">
              {tokensWithBalance.map((token) => (
                <TokenBalanceItem key={token.address} token={token} />
              ))}
            </div>
          )}

          {/* Empty State - only show if we have absolutely no tokens beyond ETH */}
          {!isLoading && tokensWithBalance.length === 0 && !hasEthBalance && (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-xs mt-1">No additional tokens found beyond ETH</p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
