import { useReadContracts, useChainId } from "wagmi";
import { erc20Abi } from "viem";
import { sepolia } from "wagmi/chains";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Search, Copy } from "lucide-react";
import { openExplorerLink, getExplorerName } from "@/utils/explorer-links";
import { useState } from "react";

const REWARDS_TOKEN_ADDRESS = "0x118f6c0090ffd227cbefe1c6d8a803198c4422f0" as const;

export const TokenInspector = () => {
  const chainId = useChainId();
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Use wagmi hook to fetch token metadata
  const {
    data: tokenMetadata,
    isLoading,
    error,
    refetch,
  } = useReadContracts({
    contracts: [
      {
        address: REWARDS_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "name",
        chainId: sepolia.id,
      },
      {
        address: REWARDS_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "symbol",
        chainId: sepolia.id,
      },
      {
        address: REWARDS_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "decimals",
        chainId: sepolia.id,
      },
    ],
  });

  // Extract token info from results
  const tokenInfo =
    tokenMetadata && tokenMetadata.every((result) => result.status === "success")
      ? {
          name: tokenMetadata[0].result as string,
          symbol: tokenMetadata[1].result as string,
          decimals: tokenMetadata[2].result as number,
          address: REWARDS_TOKEN_ADDRESS,
        }
      : null;

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
          onClick={() => openExplorerLink(chainId, "token", REWARDS_TOKEN_ADDRESS)}
          className="h-8"
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          {getExplorerName(chainId)}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Contract Address</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openExplorerLink(chainId, "token", REWARDS_TOKEN_ADDRESS)}
                className="h-6 w-6 p-0"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(REWARDS_TOKEN_ADDRESS)}
                className="h-6 w-6 p-0"
              >
                {copied ? <Copy className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
              </Button>
              <Badge variant="secondary" className="font-mono text-xs">
                {REWARDS_TOKEN_ADDRESS.slice(0, 6)}...{REWARDS_TOKEN_ADDRESS.slice(-4)}
              </Badge>
            </div>
          </div>
          <div className="text-xs font-mono text-muted-foreground break-all">{REWARDS_TOKEN_ADDRESS}</div>
        </div>

        {isLoading && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Loading token information...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600">Error: Failed to fetch token info</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
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
