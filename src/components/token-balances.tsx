import { useTokenBalances, type TokenBalance } from "@/hooks/use-token-balances";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Coins, 
  RefreshCw, 
  TrendingUp, 
  AlertCircle,
  Wallet,
  ExternalLink
} from "lucide-react";
import { useState } from "react";
import { formatUnits } from "viem";

interface TokenBalanceItemProps {
  readonly token: TokenBalance;
  readonly isEth?: boolean;
}

const TokenBalanceItem = ({ token, isEth = false }: TokenBalanceItemProps): JSX.Element => {
  const hasBalance = token.balance > 0n;
  const displayBalance = parseFloat(token.formattedBalance);
  const isSignificant = displayBalance > 0.001;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center space-x-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isEth 
            ? "bg-blue-100 text-blue-600" 
            : "bg-purple-100 text-purple-600"
        }`}>
          {isEth ? (
            <span className="text-xs font-bold">ETH</span>
          ) : (
            <Coins className="h-4 w-4" />
          )}
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
          <span className="text-sm text-destructive">Error</span>
        ) : (
          <div>
            <p className={`font-mono text-sm ${hasBalance ? "font-medium" : "text-muted-foreground"}`}>
              {isSignificant 
                ? parseFloat(token.formattedBalance).toFixed(4)
                : displayBalance > 0 
                  ? `< 0.001`
                  : "0.0000"
              }
            </p>
            <p className="text-xs text-muted-foreground">{token.symbol}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export const TokenBalances = (): JSX.Element => {
  const { ethBalance, tokenBalances, isLoading, hasError, refetch } = useTokenBalances();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    refetch();
    // Add a small delay for better UX
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const totalTokensWithBalance = tokenBalances.filter(token => token.balance > 0n).length;
  const hasEthBalance = ethBalance.balance > 0n;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center space-x-2">
          <Wallet className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Token Balances</CardTitle>
        </div>
        
        <div className="flex items-center space-x-2">
          {(hasEthBalance || totalTokensWithBalance > 0) && (
            <Badge variant="outline" className="text-xs">
              {hasEthBalance && totalTokensWithBalance > 0 
                ? `ETH + ${totalTokensWithBalance} tokens`
                : hasEthBalance 
                  ? "ETH only"
                  : `${totalTokensWithBalance} tokens`
              }
            </Badge>
          )}
          
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

        {/* ETH Balance */}
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

        {/* Token Balances */}
        <div className="space-y-2">
          {tokenBalances.map((token) => (
            <TokenBalanceItem key={token.address} token={token} />
          ))}
        </div>

        {/* Empty State */}
        {!isLoading && !hasEthBalance && totalTokensWithBalance === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No token balances found</p>
            <p className="text-xs mt-1">
              Your account doesn't have any ETH or tokens yet
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
