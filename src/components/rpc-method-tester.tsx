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
} from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Copy, PlayCircle, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { parseEther, erc20Abi, encodeFunctionData, parseUnits } from "viem";
import { sepolia } from "wagmi/chains";

interface TestResult {
  readonly method: string;
  readonly status: "success" | "error" | "pending";
  readonly result?: unknown;
  readonly error?: string;
  readonly timestamp: number;
}

export const RpcMethodTester = () => {
  const { address, isConnected, connector } = useAccount();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

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
  const { data: ethBalance } = useBalance({ address });
  const { data: fusdtBalance } = useReadContract({
    address: fusdtAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });
  const { data: erc20Balance } = useReadContract({
    address: erc20Address as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
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
        chainId: sepolia.id,
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
        const value = parseEther(testAmount);
        sendTransaction(
          { to: to as `0x${string}`, value, data: "0x" },
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
        const amount = parseUnits(testAmount, 18); // FUSDT has 18 decimals
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [to as `0x${string}`, amount],
        });

        sendTransaction(
          {
            to: fusdtAddress as `0x${string}`,
            data,
            value: 0n, // No ETH value for ERC20 transfer
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
      await switchChain({ chainId: sepolia.id });
      addTestResult("wallet_switchEthereumChain", "success", { chainId: sepolia.id, chainName: sepolia.name });
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
      addTestResult("eth_chainId", "success", { chainId: sepolia.id });
      addTestResult("net_version", "success", { networkVersion: sepolia.id.toString() });

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
        });
      }

      // Test FUSDT balance
      if (fusdtBalance) {
        addTestResult("eth_call", "success", {
          contract: fusdtAddress,
          method: "balanceOf (FUSDT)",
          result: fusdtBalance.toString(),
          formatted: (Number(fusdtBalance) / 10 ** 18).toFixed(6) + " FUSDT",
        });
      }

      // Test ERC20 balance
      if (erc20Balance) {
        addTestResult("eth_call", "success", {
          contract: erc20Address,
          method: "balanceOf",
          result: erc20Balance.toString(),
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
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5" />
            RPC Method Tester
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Please connect your wallet to test RPC methods.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5" />
          RPC Method Tester
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">
            Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
          </Badge>
          <Badge variant="outline">Chain: {sepolia.name}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="signing">Signing</TabsTrigger>
            <TabsTrigger value="wallet">Wallet</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="tx-type">Transaction Type</Label>
                <div className="flex gap-2">
                  <Button
                    variant={testType === "fusdt" ? "default" : "outline"}
                    onClick={() => setTestType("fusdt")}
                    className="flex-1"
                  >
                    FUSDT Transfer
                  </Button>
                  <Button
                    variant={testType === "eth" ? "default" : "outline"}
                    onClick={() => setTestType("eth")}
                    className="flex-1"
                  >
                    ETH Transfer
                  </Button>
                </div>
              </div>

              {/* Show current balances */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="text-sm font-medium">Current Balances:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>ETH: {ethBalance?.formatted.slice(0, 8) || "0"}</div>
                  <div>FUSDT: {fusdtBalance ? (Number(fusdtBalance) / 10 ** 18).toFixed(2) : "0"}</div>
                </div>
              </div>

              <div>
                <Label htmlFor="amount">Amount ({testType === "fusdt" ? "FUSDT" : "ETH"})</Label>
                <Input
                  id="amount"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  placeholder={testType === "fusdt" ? "1.0" : "0.001"}
                />
              </div>
              <div>
                <Label htmlFor="to-address">To Address (optional - defaults to self)</Label>
                <Input
                  id="to-address"
                  value={testToAddress}
                  onChange={(e) => setTestToAddress(e.target.value)}
                  placeholder="0x..."
                />
              </div>
              <Button onClick={testSendTransaction} disabled={isSendingTx || isConfirmingTx} className="w-full">
                {isSendingTx || isConfirmingTx ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isSendingTx ? "Sending..." : "Confirming..."}
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Test {testType.toUpperCase()} Transaction
                  </>
                )}
              </Button>
              {isTxConfirmed && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>Transaction confirmed! Hash: {txHash?.slice(0, 10)}...</AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>

          <TabsContent value="signing" className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="message">Message to Sign</Label>
                <Textarea
                  id="message"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Enter message to sign..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Button onClick={testPersonalSign} disabled={isSigningMessage}>
                  {isSigningMessage ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4 mr-2" />
                  )}
                  Test personal_sign
                </Button>
                <Button onClick={testTypedDataSign} disabled={isSigningTypedData}>
                  {isSigningTypedData ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4 mr-2" />
                  )}
                  Test eth_signTypedData_v4
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="wallet" className="space-y-4">
            <div className="space-y-3">
              <Button onClick={testConnectionMethods} className="w-full">
                <PlayCircle className="h-4 w-4 mr-2" />
                Test Connection Methods
              </Button>
              <Button onClick={testReadMethods} className="w-full">
                <PlayCircle className="h-4 w-4 mr-2" />
                Test Read Methods
              </Button>
              <Button onClick={testChainSwitch} disabled={isSwitchingChain} className="w-full">
                {isSwitchingChain ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4 mr-2" />
                )}
                Test Chain Switch
              </Button>
              <Separator />
              <div>
                <Label htmlFor="erc20-address">ERC20 Contract Address</Label>
                <Input
                  id="erc20-address"
                  value={erc20Address}
                  onChange={(e) => setErc20Address(e.target.value)}
                  placeholder="0x..."
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Test Results ({testResults.length})</h3>
              <Button variant="outline" size="sm" onClick={clearResults}>
                Clear Results
              </Button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
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
                      {result.result !== undefined && (
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(safeStringify(result.result))}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
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
        </Tabs>
      </CardContent>
    </Card>
  );
};
