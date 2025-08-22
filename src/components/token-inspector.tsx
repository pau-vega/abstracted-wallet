import { useEffect, useState } from "react";
import { getTokenInfo } from "@/utils/get-token-info";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Search } from "lucide-react";

const REWARDS_TOKEN_ADDRESS = "0x118f6c0090ffd227cbefe1c6d8a803198c4422f0" as const;

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  address: `0x${string}`;
}

export const TokenInspector = (): JSX.Element => {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokenInfo = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      const info = await getTokenInfo(REWARDS_TOKEN_ADDRESS);
      setTokenInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch token info");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokenInfo();
  }, []);

  const openEtherscan = (): void => {
    window.open(`https://sepolia.etherscan.io/token/${REWARDS_TOKEN_ADDRESS}`, "_blank");
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center space-x-2">
          <Search className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Rewards Token Inspector</CardTitle>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={openEtherscan}
          className="h-8"
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          Etherscan
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Contract Address</span>
            <Badge variant="secondary" className="font-mono text-xs">
              {REWARDS_TOKEN_ADDRESS.slice(0, 6)}...{REWARDS_TOKEN_ADDRESS.slice(-4)}
            </Badge>
          </div>
          <div className="text-xs font-mono text-muted-foreground break-all">
            {REWARDS_TOKEN_ADDRESS}
          </div>
        </div>

        {loading && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Loading token information...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600">Error: {error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTokenInfo}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        )}

        {tokenInfo && (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
              <h3 className="font-medium text-green-700">Token Details</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{tokenInfo.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Symbol:</span>
                  <span className="font-medium">{tokenInfo.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Decimals:</span>
                  <span className="font-medium">{tokenInfo.decimals}</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground text-center">
              This is the actual token deployed on Sepolia that you receive when claiming rewards.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
