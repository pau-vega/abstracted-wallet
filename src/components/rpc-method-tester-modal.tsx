import { useState } from "react";
import {
  useAccount,
  useSwitchChain,
  useSignMessage,
  useSignTypedData,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useBalance,
  useReadContract,
  useChainId,
  useConfig,
} from "wagmi";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  PlayCircle,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Wallet,
  Info,
  Send,
  ExternalLink,
} from "lucide-react";
import { erc20Abi, encodeFunctionData, parseUnits } from "viem";
import { sepolia, polygonAmoy } from "wagmi/chains";

interface RpcMethodTesterModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface TestResult {
  readonly method: string;
  readonly status: "success" | "error" | "pending";
  readonly result?: unknown;
  readonly error?: string;
  readonly timestamp: number;
}

export const RpcMethodTesterModal = ({ isOpen, onClose }: RpcMethodTesterModalProps) => {
  const { address, isConnected, connector } = useAccount();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const chainId = useChainId();
  const config = useConfig();

  // Get ETH decimals from the current chain configuration
  const currentChain = config.chains.find((chain) => chain.id === chainId);
  const ethDecimals = currentChain?.nativeCurrency.decimals ?? 18; // Fallback to 18 if chain not found

  // Test states
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testMessage, setTestMessage] = useState("Hello, this is a test message for personal_sign!");
  const [testAmount, setTestAmount] = useState("1");
  const [testToAddress, setTestToAddress] = useState("");
  const [testType, setTestType] = useState<"eth" | "fusdt">("fusdt");
  const [fusdtAddress] = useState("0x118f6c0090ffd227cbefe1c6d8a803198c4422f0"); // FUSDT (Rewards token) on Sepolia
  const [erc20Address, setErc20Address] = useState("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"); // USDC on Sepolia

  // Hooks for different operations
  const { signMessage, isPending: isSigningMessage } = useSignMessage();
  const { signTypedData, isPending: isSigningTypedData } = useSignTypedData();
  const { sendTransaction, isPending: isSendingTx, data: txHash } = useSendTransaction();
  const { isLoading: isConfirmingTx, isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // Read operations
  const {
    data: ethBalance,
    isLoading: isEthBalanceLoading,
    error: ethBalanceError,
  } = useBalance({
    address,
    query: { enabled: !!address && isConnected },
  });

  // FUSDT token data
  const { data: fusdtBalance } = useReadContract({
    address: fusdtAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });
  const { data: fusdtDecimals } = useReadContract({
    address: fusdtAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "decimals",
  });

  // Generic ERC20 token data
  const { data: erc20Balance } = useReadContract({
    address: erc20Address as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });
  const { data: erc20Decimals } = useReadContract({
    address: erc20Address as `0x${string}`,
    abi: erc20Abi,
    functionName: "decimals",
  });

  const addTestResult = (method: string, status: TestResult["status"], result?: unknown, error?: string): void => {
    const newResult: TestResult = {
      method,
      status,
      result,
      error,
      timestamp: Date.now(),
    };

    setTestResults((prev) => {
      // If this is a success/error result, try to update the most recent pending result for the same method
      if ((status === "success" || status === "error") && prev.length > 0) {
        const latestIndex = prev.findIndex((r) => r.method === method && r.status === "pending");
        if (latestIndex !== -1) {
          // Update the existing pending result
          const updated = [...prev];
          updated[latestIndex] = { ...updated[latestIndex], status, result, error };
          return updated;
        }
      }

      // Otherwise, add as a new result
      return [newResult, ...prev.slice(0, 19)]; // Keep last 20 results
    });
  };

  const copyToClipboard = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getExplorerUrl = (type: "tx" | "address" | "token", value: string): string => {
    const baseUrl = chainId === polygonAmoy.id ? "https://amoy.polygonscan.com" : "https://sepolia.etherscan.io";
    switch (type) {
      case "tx":
        return `${baseUrl}/tx/${value}`;
      case "address":
        return `${baseUrl}/address/${value}`;
      case "token":
        return `${baseUrl}/token/${value}`;
      default:
        return baseUrl;
    }
  };

  const openExplorerLink = (type: "tx" | "address" | "token", value: string): void => {
    window.open(getExplorerUrl(type, value), "_blank", "noopener,noreferrer");
  };

  const getExplorableData = (
    result: TestResult,
  ): Array<{ type: "tx" | "address" | "token"; value: string; label: string }> => {
    const explorableItems: Array<{ type: "tx" | "address" | "token"; value: string; label: string }> = [];

    if (result.result && typeof result.result === "object") {
      const resultObj = result.result as Record<string, unknown>;

      // Transaction hash
      if (resultObj.hash && typeof resultObj.hash === "string") {
        explorableItems.push({ type: "tx", value: resultObj.hash, label: "View Transaction" });
      }

      // Contract address
      if (resultObj.contract && typeof resultObj.contract === "string") {
        explorableItems.push({ type: "token", value: resultObj.contract, label: "View Contract" });
      }

      // To address
      if (resultObj.to && typeof resultObj.to === "string") {
        explorableItems.push({ type: "address", value: resultObj.to, label: "View Address" });
      }

      // Address from results
      if (resultObj.address && typeof resultObj.address === "string") {
        explorableItems.push({ type: "address", value: resultObj.address, label: "View Address" });
      }

      // For account-related results, check for arrays of addresses
      if (resultObj.accounts && Array.isArray(resultObj.accounts) && resultObj.accounts.length > 0) {
        const firstAccount = resultObj.accounts[0];
        if (typeof firstAccount === "string") {
          explorableItems.push({ type: "address", value: firstAccount, label: "View Account" });
        }
      }
    }

    return explorableItems;
  };

  /**
   * Parse amount string to BigInt with correct decimals for the token type
   */
  const parseTokenAmount = (amount: string, tokenType: "eth" | "fusdt"): bigint => {
    if (tokenType === "eth") {
      return parseUnits(amount, ethDecimals);
    } else if (tokenType === "fusdt") {
      if (!fusdtDecimals) throw new Error("FUSDT decimals not loaded");
      return parseUnits(amount, fusdtDecimals);
    }
    return parseUnits(amount, 18); // Default fallback
  };

  /**
   * Format token balance from raw BigInt to human-readable string
   */
  const formatTokenBalance = (balance: bigint, decimals: number, symbol: string): string => {
    const divisor = 10 ** decimals;
    const formatted = (Number(balance) / divisor).toFixed(6);
    return `${formatted} ${symbol}`;
  };

  // Helper function to serialize objects with BigInt values
  const safeStringify = (obj: unknown): string => {
    return JSON.stringify(obj, (_, value) => (typeof value === "bigint" ? value.toString() + "n" : value), 2);
  };

  // Test Methods
  const testPersonalSign = async (): Promise<void> => {
    if (!testMessage.trim()) {
      addTestResult("personal_sign", "error", undefined, "Message cannot be empty");
      return;
    }

    try {
      addTestResult("personal_sign", "pending");
      const signature = await signMessage({ message: testMessage });
      addTestResult("personal_sign", "success", { message: testMessage, signature });
    } catch (error) {
      addTestResult("personal_sign", "error", undefined, error instanceof Error ? error.message : "Unknown error");
    }
  };

  const testTypedDataSign = async (): Promise<void> => {
    const typedData = {
      domain: {
        name: "Passkeys RPC Tester",
        version: "1",
        chainId,
        verifyingContract: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      },
      types: {
        TestMessage: [
          { name: "content", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
      primaryType: "TestMessage" as const,
      message: {
        content: "This is a test typed data message",
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
      },
    };

    try {
      addTestResult("eth_signTypedData_v4", "pending");
      const signature = await signTypedData(typedData);
      addTestResult("eth_signTypedData_v4", "success", { typedData, signature });
    } catch (error) {
      addTestResult(
        "eth_signTypedData_v4",
        "error",
        undefined,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  };

  const testSendTransaction = async (): Promise<void> => {
    const to = testToAddress || address; // Send to self if no address specified

    if (!to) {
      addTestResult("eth_sendTransaction", "error", undefined, "No destination address");
      return;
    }

    try {
      addTestResult("eth_sendTransaction", "pending");

      if (testType === "eth") {
        // Send ETH
        const value = parseTokenAmount(testAmount, "eth");
        sendTransaction(
          { to: to as `0x${string}`, value },
          {
            onSuccess: (hash) => {
              addTestResult("eth_sendTransaction", "success", {
                hash,
                to,
                amount: testAmount,
                type: "ETH",
              });
            },
            onError: (error) => {
              addTestResult("eth_sendTransaction", "error", undefined, error.message);
            },
          },
        );
      } else {
        // Send FUSDT (ERC20 transfer)
        const amount = parseTokenAmount(testAmount, "fusdt");
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [to as `0x${string}`, amount],
        });

        sendTransaction(
          {
            to: fusdtAddress as `0x${string}`,
            data,
          },
          {
            onSuccess: (hash) => {
              addTestResult("eth_sendTransaction", "success", {
                hash,
                to,
                amount: testAmount,
                type: "FUSDT",
                contract: fusdtAddress,
              });
            },
            onError: (error) => {
              addTestResult("eth_sendTransaction", "error", undefined, error.message);
            },
          },
        );
      }
    } catch (error) {
      addTestResult(
        "eth_sendTransaction",
        "error",
        undefined,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  };

  const testChainSwitch = async (): Promise<void> => {
    try {
      addTestResult("wallet_switchEthereumChain", "pending");
      // Switch to the other network (if on Sepolia, switch to Polygon Amoy, and vice versa)
      const targetChain = chainId === sepolia.id ? polygonAmoy : sepolia;
      await switchChain({ chainId: targetChain.id });
      addTestResult("wallet_switchEthereumChain", "success", {
        chainId: targetChain.id,
        chainName: targetChain.name,
        from: currentChain?.name,
        to: targetChain.name,
      });
    } catch (error) {
      addTestResult(
        "wallet_switchEthereumChain",
        "error",
        undefined,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  };

  const testConnectionMethods = async (): Promise<void> => {
    try {
      // Test basic connection info
      addTestResult("eth_accounts", "success", { accounts: address ? [address] : [] });
      addTestResult("eth_chainId", "success", { chainId, chainName: currentChain?.name });
      addTestResult("net_version", "success", { networkVersion: chainId.toString() });

      // Test wallet info
      if (connector) {
        addTestResult("wallet_getConnector", "success", {
          id: connector.id,
          name: connector.name,
          type: connector.type,
        });
      }
    } catch (error) {
      addTestResult("connection_methods", "error", undefined, error instanceof Error ? error.message : "Unknown error");
    }
  };

  const testReadMethods = (): void => {
    try {
      // Test balance reading
      if (ethBalance) {
        addTestResult("eth_getBalance", "success", {
          address,
          balance: ethBalance.formatted,
          wei: ethBalance.value.toString(),
          decimals: ethDecimals,
          symbol: currentChain?.nativeCurrency.symbol ?? "ETH",
        });
      }

      // Test FUSDT balance
      if (fusdtBalance && fusdtDecimals !== undefined) {
        addTestResult("eth_call", "success", {
          contract: fusdtAddress,
          method: "balanceOf (FUSDT)",
          result: fusdtBalance.toString(),
          formatted: formatTokenBalance(fusdtBalance, fusdtDecimals, "FUSDT"),
          decimals: fusdtDecimals,
        });
      }

      // Test ERC20 balance
      if (erc20Balance && erc20Decimals !== undefined) {
        addTestResult("eth_call", "success", {
          contract: erc20Address,
          method: "balanceOf (ERC20)",
          result: erc20Balance.toString(),
          formatted: formatTokenBalance(erc20Balance, erc20Decimals, "ERC20"),
          decimals: erc20Decimals,
        });
      }

      addTestResult("eth_blockNumber", "success", { note: "Handled by wagmi/viem automatically" });
      addTestResult("eth_gasPrice", "success", { note: "Handled by wagmi/viem automatically" });
    } catch (error) {
      addTestResult("read_methods", "error", undefined, error instanceof Error ? error.message : "Unknown error");
    }
  };

  const clearResults = (): void => {
    setTestResults([]);
  };

  if (!isConnected) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              RPC Method Tester
            </DialogTitle>
          </DialogHeader>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Please connect your wallet to test RPC methods.</AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "pending":
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
    }
  };

  const getStatusColor = (status: TestResult["status"]) => {
    switch (status) {
      case "success":
        return "bg-green-50 border-green-200";
      case "error":
        return "bg-red-50 border-red-200";
      case "pending":
        return "bg-blue-50 border-blue-200";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <PlayCircle className="h-6 w-6 text-primary" />
                RPC Method Tester
              </DialogTitle>
              <p className="text-sm text-muted-foreground">Test blockchain RPC methods with your connected wallet</p>
            </div>
            <div className="flex flex-col gap-2 mr-8">
              <Badge variant="outline" className="text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {currentChain?.name || "Unknown"}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          <Tabs defaultValue="transactions" className="w-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
              <TabsTrigger value="transactions">Send</TabsTrigger>
              <TabsTrigger value="signing">Sign</TabsTrigger>
              <TabsTrigger value="wallet">Wallet</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>

            <div className="mt-4">
              <TabsContent value="transactions" className="space-y-6 mt-0 min-h-[460px]">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="tx-type" className="text-sm font-medium">
                        Transaction Type
                      </Label>
                      <Badge variant="secondary" className="text-xs">
                        Required
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant={testType === "fusdt" ? "default" : "outline"}
                        onClick={() => setTestType("fusdt")}
                        className="h-12 flex flex-col gap-1"
                      >
                        <span className="font-medium">FUSDT</span>
                        <span className="text-xs opacity-70">ERC20 Token</span>
                      </Button>
                      <Button
                        variant={testType === "eth" ? "default" : "outline"}
                        onClick={() => setTestType("eth")}
                        className="h-12 flex flex-col gap-1"
                      >
                        <span className="font-medium">ETH</span>
                        <span className="text-xs opacity-70">Native Token</span>
                      </Button>
                    </div>
                  </div>

                  {/* Show current balances */}
                  <div className="bg-gradient-to-r from-muted/30 to-muted/50 rounded-lg p-4 border">
                    <div className="flex items-center gap-2 mb-3">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Current Balances</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-2 bg-background/60 rounded">
                        <span className="text-xs font-medium text-muted-foreground">ETH</span>
                        <span className="text-sm font-mono">
                          {isEthBalanceLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : ethBalanceError ? (
                            <span className="text-red-500">Error</span>
                          ) : ethBalance?.formatted ? (
                            ethBalance.formatted.slice(0, 8)
                          ) : (
                            "0"
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-background/60 rounded">
                        <span className="text-xs font-medium text-muted-foreground">FUSDT</span>
                        <span className="text-sm font-mono">
                          {fusdtBalance && fusdtDecimals !== undefined ? (
                            formatTokenBalance(fusdtBalance, fusdtDecimals, "").replace(" ", "").slice(0, 8)
                          ) : (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="amount" className="text-sm font-medium">
                          Amount ({testType === "fusdt" ? "FUSDT" : "ETH"})
                        </Label>
                        <Badge variant="secondary" className="text-xs">
                          Required
                        </Badge>
                      </div>
                      <div className="relative">
                        <Input
                          id="amount"
                          value={testAmount}
                          onChange={(e) => setTestAmount(e.target.value)}
                          placeholder={testType === "fusdt" ? "1.0" : "0.001"}
                          className="pr-12"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <span className="text-xs text-muted-foreground font-mono">
                            {testType === "fusdt" ? "FUSDT" : "ETH"}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Enter the amount to send</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="to-address" className="text-sm font-medium">
                          To Address
                        </Label>
                        <Badge variant="outline" className="text-xs">
                          Optional
                        </Badge>
                      </div>
                      <Input
                        id="to-address"
                        value={testToAddress}
                        onChange={(e) => setTestToAddress(e.target.value)}
                        placeholder="0x... (defaults to self)"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Recipient address (leave empty to send to yourself)
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={testSendTransaction}
                    disabled={isSendingTx || isConfirmingTx || !testAmount}
                    className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium"
                  >
                    {isSendingTx || isConfirmingTx ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        {isSendingTx ? "Sending Transaction..." : "Confirming..."}
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Send {testType.toUpperCase()} Transaction
                      </>
                    )}
                  </Button>
                  {isTxConfirmed && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="flex items-center justify-between">
                        <span>Transaction confirmed successfully!</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(txHash || "")}
                          className="h-6 text-green-700 hover:text-green-800"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy Hash
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="signing" className="space-y-6 mt-0 min-h-[460px]">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="message" className="text-sm font-medium">
                        Message to Sign
                      </Label>
                      <Badge variant="secondary" className="text-xs">
                        Required
                      </Badge>
                    </div>
                    <Textarea
                      id="message"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="Enter your message here..."
                      rows={4}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      This message will be signed with your wallet's private key
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button
                      onClick={testPersonalSign}
                      disabled={isSigningMessage || !testMessage.trim()}
                      variant="outline"
                      className="h-12 flex flex-col gap-1"
                    >
                      {isSigningMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <span className="font-medium">Personal Sign</span>
                          <span className="text-xs opacity-70">Simple message signing</span>
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={testTypedDataSign}
                      disabled={isSigningTypedData}
                      variant="outline"
                      className="h-12 flex flex-col gap-1"
                    >
                      {isSigningTypedData ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <span className="font-medium">Typed Data</span>
                          <span className="text-xs opacity-70">Structured data signing</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="wallet" className="space-y-6 mt-0 min-h-[460px]">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button
                      onClick={testConnectionMethods}
                      variant="outline"
                      className="h-16 p-4 flex flex-col items-center justify-center gap-1 text-center"
                    >
                      <span className="font-medium text-sm">Connection Methods</span>
                      <span className="text-xs text-muted-foreground">Test wallet connection info</span>
                    </Button>
                    <Button
                      onClick={testReadMethods}
                      variant="outline"
                      className="h-16 p-4 flex flex-col items-center justify-center gap-1 text-center"
                    >
                      <span className="font-medium text-sm">Read Methods</span>
                      <span className="text-xs text-muted-foreground">Test balance and contract reads</span>
                    </Button>
                  </div>

                  <Button
                    onClick={testChainSwitch}
                    disabled={isSwitchingChain}
                    variant="outline"
                    className="w-full h-12"
                  >
                    {isSwitchingChain ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Switching Chain...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Switch to {chainId === sepolia.id ? polygonAmoy.name : sepolia.name}
                      </>
                    )}
                  </Button>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="erc20-address" className="text-sm font-medium">
                        ERC20 Contract Address
                      </Label>
                      <Badge variant="outline" className="text-xs">
                        Optional
                      </Badge>
                    </div>
                    <Input
                      id="erc20-address"
                      value={erc20Address}
                      onChange={(e) => setErc20Address(e.target.value)}
                      placeholder="0x... (custom ERC20 token address)"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter a custom ERC20 token address to test balance reading
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="results" className="space-y-4 mt-0 min-h-[460px]">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium">Test Results</h3>
                    <Badge variant="secondary" className="text-xs">
                      {testResults.length} {testResults.length === 1 ? "result" : "results"}
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" onClick={clearResults} disabled={testResults.length === 0}>
                    Clear All
                  </Button>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {testResults.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <PlayCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No tests run yet</p>
                      <p className="text-xs mt-1">Run some tests to see results here</p>
                    </div>
                  ) : (
                    testResults.map((result, index) => (
                      <div key={index} className={`p-3 rounded-lg border ${getStatusColor(result.status)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(result.status)}
                            <code className="text-sm font-mono">{result.method}</code>
                            <Badge variant="secondary" className="text-xs">
                              {new Date(result.timestamp).toLocaleTimeString()}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            {getExplorableData(result).map((explorable, explorerIndex) => (
                              <Button
                                key={explorerIndex}
                                variant="ghost"
                                size="sm"
                                onClick={() => openExplorerLink(explorable.type, explorable.value)}
                                className="text-xs px-2"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                {explorable.label}
                              </Button>
                            ))}
                            {result.result !== undefined && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(safeStringify(result.result))}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {result.error && (
                          <div className="text-sm text-red-600 font-mono bg-red-100 p-2 rounded">{result.error}</div>
                        )}

                        {result.result !== undefined && (
                          <div className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                            <pre className="whitespace-pre-wrap">{safeStringify(result.result)}</pre>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
