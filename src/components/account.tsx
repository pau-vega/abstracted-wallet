import { useAccount, useDisconnect, useEnsAvatar, useEnsName } from "wagmi";
import { usePasskeyName } from "@/hooks/use-passkey-name";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Shield, LogOut, Copy, Gift, TestTube } from "lucide-react";
import { useState } from "react";
import { RewardsModal } from "@/components/rewards-modal";
import { SimpleTestModal } from "@/components/simple-test-modal";
import { TokenBalances } from "@/components/token-balances";

export function Account() {
  const { address, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({ address });
  const { data: ensAvatar } = useEnsAvatar({ name: ensName! });
  const passkeyName = usePasskeyName();
  const [copied, setCopied] = useState(false);
  const [isRewardsModalOpen, setIsRewardsModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const isPasskey = connector?.name === "Passkey";

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <CardTitle className="text-2xl font-bold text-green-700">Connected Successfully!</CardTitle>

        {isPasskey && (
          <div className="space-y-2">
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-2">
              <Shield className="mr-2 h-4 w-4" />
              Secured with Passkey Authentication
            </Badge>
            {passkeyName && (
              <div className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-1.5 border">
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                <span>
                  Passkey: <span className="font-medium text-foreground">"{passkeyName}"</span>
                </span>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex flex-col items-center space-y-4">
          {ensAvatar && (
            <Avatar className="w-16 h-16">
              <AvatarImage src={ensAvatar} alt="ENS Avatar" />
              <AvatarFallback>{ensName ? ensName.charAt(0).toUpperCase() : "?"}</AvatarFallback>
            </Avatar>
          )}

          <div className="w-full space-y-3">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Smart Account Address</span>
                <Button variant="ghost" size="sm" onClick={copyAddress} className="h-6 w-6 p-0">
                  {copied ? <CheckCircle className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <div className="font-mono text-sm break-all">{address}</div>
              {ensName && <div className="text-sm text-blue-600 font-medium">ENS: {ensName}</div>}
            </div>

            {connector && (
              <div className="text-center">
                <span className="text-sm text-muted-foreground">Connected via {connector.name}</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Token Balances Section */}
        <div className="space-y-4">
          <TokenBalances />
        </div>

        <Separator />

        <div className="space-y-3">
          <Button
            onClick={() => setIsTestModalOpen(true)}
            variant="default"
            size="lg"
            className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white border-0"
          >
            <TestTube className="mr-2 h-4 w-4" />
            Test Smart Account
          </Button>

          <Button
            onClick={() => setIsRewardsModalOpen(true)}
            variant="default"
            size="lg"
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
          >
            <Gift className="mr-2 h-4 w-4" />
            Claim Rewards (100 Tokens)
          </Button>

          <Button
            onClick={() => disconnect()}
            variant="outline"
            size="lg"
            className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect Wallet
          </Button>
        </div>
      </CardContent>

      <SimpleTestModal isOpen={isTestModalOpen} onClose={() => setIsTestModalOpen(false)} />
      <RewardsModal isOpen={isRewardsModalOpen} onClose={() => setIsRewardsModalOpen(false)} />
    </>
  );
}
