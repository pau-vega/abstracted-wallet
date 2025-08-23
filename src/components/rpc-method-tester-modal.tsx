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
import { useGasEstimation } from "@/hooks/use-gas-estimation";
import { GasEstimationDisplay } from "@/components/gas-estimation-display";
import { toast } from "sonner";
import { openExplorerLink as utilOpenExplorerLink } from "@/utils/explorer-links";

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

  // Loading states for better user feedback
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isTestingRead, setIsTestingRead] = useState(false);
  const [isTestingPersonalSign, setIsTestingPersonalSign] = useState(false);
  const [isTestingTypedData, setIsTestingTypedData] = useState(false);

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

  // Helper function to get appropriate wallet name
  const getWalletName = (): string => {
    if (!connector) return "wallet";

    // Check for passkeys connector
    if (connector.id === "passkeys") {
      return "passkeys wallet";
    }

    // Check for MetaMask
    if (connector.id === "metaMask") {
      return "MetaMask";
    }

    // Check for other common connectors
    if (connector.id === "walletConnect") {
      return "WalletConnect";
    }

    if (connector.id === "coinbaseWallet") {
      return "Coinbase Wallet";
    }

    if (connector.id === "injected") {
      return "browser wallet";
    }

    if (connector.id === "rainbow") {
      return "Rainbow Wallet";
    }

    if (connector.id === "trust") {
      return "Trust Wallet";
    }

    if (connector.id === "imToken") {
      return "imToken";
    }

    if (connector.id === "argent") {
      return "Argent";
    }

    if (connector.id === "brave") {
      return "Brave Wallet";
    }

    // Fallback to connector name or generic "wallet"
    return connector.name || "wallet";
  };

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

  // Gas estimation for transactions
  const transactionData = (() => {
    if (!testAmount || (!testToAddress && !address)) return undefined;

    const to = testToAddress || address;
    if (!to) return undefined;

    try {
      if (testType === "eth") {
        return {
          to: to as `0x${string}`,
          value: parseTokenAmount(testAmount, "eth"),
          data: undefined as `0x${string}` | undefined,
        };
      } else {
        // FUSDT transfer - only proceed if decimals are loaded
        if (!fusdtDecimals) return undefined;

        const amount = parseTokenAmount(testAmount, "fusdt");
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [to as `0x${string}`, amount],
        });

        return {
          to: fusdtAddress as `0x${string}`,
          value: 0n,
          data,
        };
      }
    } catch (error) {
      // If there's an error parsing the amount, return undefined
      console.warn("Error preparing transaction data:", error);
      return undefined;
    }
  })();

  const gasEstimation = useGasEstimation({
    to: transactionData?.to,
    value: transactionData?.value,
    data: transactionData?.data,
    enabled: isOpen && !!address && !!testAmount && (!!testToAddress || !!address) && !!transactionData,
  });

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
    try {
      setIsTestingPersonalSign(true);
      addTestResult("personal_sign", "pending");
      const signature = await signMessage({ message: testMessage });
      addTestResult("personal_sign", "success", {
        message: testMessage,
        signature,
        signer: address,
      });
      toast.success("Message signed successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      addTestResult("personal_sign", "error", undefined, errorMessage);
    } finally {
      setIsTestingPersonalSign(false);
    }
  };

  const testTypedDataSign = async (): Promise<void> => {
    try {
      setIsTestingTypedData(true);
      addTestResult("eth_signTypedData_v4", "pending");
      const typedData = {
        types: {
          Person: [
            { name: "name", type: "string" },
            { name: "wallet", type: "address" },
          ],
        },
        primaryType: "Person" as const,
        domain: {
          name: "Test App",
          version: "1",
          chainId: chainId,
          verifyingContract: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        },
        message: {
          name: "Test User",
          wallet: address,
        },
      };

      const signature = await signTypedData({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      });

      addTestResult("eth_signTypedData_v4", "success", {
        typedData,
        signature,
        signer: address,
      });
      toast.success("Typed data signed successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      addTestResult("eth_signTypedData_v4", "error", undefined, errorMessage);
    } finally {
      setIsTestingTypedData(false);
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
        const value = parseUnits(testAmount, ethDecimals);
        const gasParams = gasEstimation.selected.maxFeePerGas
          ? {
              gas: gasEstimation.selected.gasLimit,
              maxFeePerGas: gasEstimation.selected.maxFeePerGas,
              maxPriorityFeePerGas: gasEstimation.selected.maxPriorityFeePerGas,
            }
          : {
              gas: gasEstimation.selected.gasLimit,
              gasPrice: gasEstimation.selected.gasPrice,
            };

        sendTransaction(
          {
            to: to as `0x${string}`,
            value,
            ...gasParams,
          },
          {
            onSuccess: (hash) => {
              addTestResult("eth_sendTransaction", "success", {
                hash,
                to,
                amount: testAmount,
                type: "ETH",
                gasUsed: gasEstimation.selected.gasLimit,
                gasPrice: gasEstimation.selected.gasPrice,
              });
              toast.success("Transaction sent successfully!");
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

        const gasParams = gasEstimation.selected.maxFeePerGas
          ? {
              gas: gasEstimation.selected.gasLimit,
              maxFeePerGas: gasEstimation.selected.maxFeePerGas,
              maxPriorityFeePerGas: gasEstimation.selected.maxPriorityFeePerGas,
            }
          : {
              gas: gasEstimation.selected.gasLimit,
              gasPrice: gasEstimation.selected.gasPrice,
            };

        sendTransaction(
          {
            to: fusdtAddress as `0x${string}`,
            data,
            ...gasParams,
          },
          {
            onSuccess: (hash) => {
              addTestResult("eth_sendTransaction", "success", {
                hash,
                to,
                amount: testAmount,
                type: "FUSDT",
                contract: fusdtAddress,
                gasUsed: gasEstimation.selected.gasLimit,
                gasPrice: gasEstimation.selected.gasPrice,
              });
              toast.success("Transaction sent successfully!");
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
      toast.success("Chain switched successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      addTestResult("wallet_switchEthereumChain", "error", undefined, errorMessage);
    }
  };

  const testConnectionMethods = async (): Promise<void> => {
    try {
      setIsTestingConnection(true);
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

      toast.success("Connection methods tested successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      addTestResult("connection_methods", "error", undefined, errorMessage);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const testReadMethods = (): void => {
    try {
      setIsTestingRead(true);
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

      toast.success("Read methods executed successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      addTestResult("read_methods", "error", undefined, errorMessage);
    } finally {
      setIsTestingRead(false);
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
      <DialogContent className="sm:max-w-4xl h-[85vh] overflow-hidden flex flex-col">
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
              <Badge variant="outline" className="text-xs">
                <Wallet className="h-3 w-3 mr-1" />
                {getWalletName()}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          <Tabs defaultValue="transactions" className="w-full flex flex-col h-full">
            <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
              <TabsTrigger value="transactions">Send</TabsTrigger>
              <TabsTrigger value="signing">Sign</TabsTrigger>
              <TabsTrigger value="wallet">Wallet</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>

            <div className="mt-4 flex-1 overflow-y-auto">
              <TabsContent value="transactions" className="space-y-6 mt-0">
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

                  {/* Gas Estimation Display */}
                  {address && testAmount && (testToAddress || address) && !isSendingTx && !isConfirmingTx && (
                    <GasEstimationDisplay
                      slow={gasEstimation.slow}
                      standard={gasEstimation.standard}
                      fast={gasEstimation.fast}
                      selectedOption={gasEstimation.selectedOption}
                      onOptionChange={gasEstimation.setSelectedOption}
                      isLoading={gasEstimation.isLoading}
                      error={gasEstimation.error}
                      variant="default"
                    />
                  )}

                  {/* Network Validation Warning */}
                  {testType === "fusdt" && chainId !== sepolia.id && (
                    <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
                      <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <AlertDescription>
                        <strong>Warning:</strong> FUSDT token transfers only work on Sepolia network. Current network:{" "}
                        {currentChain?.name || `Chain ID: ${chainId}`}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => switchChain({ chainId: sepolia.id })}
                          className="ml-2 h-6"
                        >
                          Switch to Sepolia
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* FUSDT Data Status */}
                  {testType === "fusdt" && (
                    <div className="bg-muted/30 rounded-lg p-3 border">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">FUSDT Token Status</span>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Contract: {fusdtAddress}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => utilOpenExplorerLink(chainId, "token", fusdtAddress)}
                            className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                        <div>Network: {currentChain?.name || `Chain ID: ${chainId}`}</div>
                        <div>Decimals: {fusdtDecimals !== undefined ? fusdtDecimals : "Loading..."}</div>
                        <div>
                          Your Balance:{" "}
                          {fusdtBalance ? formatTokenBalance(fusdtBalance, fusdtDecimals || 18, "FUSDT") : "Loading..."}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Faucet Link for Test ETH */}
                  {address && !isSendingTx && !isConfirmingTx && (
                    <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 bg-blue-100 dark:bg-blue-800/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">?</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                            Don't have ETH for gas? Get free test ETH for testing.
                          </p>
                          <a
                            href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline"
                          >
                            <span>Google Cloud Sepolia Faucet</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={testSendTransaction}
                    disabled={isSendingTx || isConfirmingTx || !testAmount || !gasEstimation.selected}
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

                  {/* Transaction Status Indicator */}
                  {(isSendingTx || isConfirmingTx) && (
                    <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                          Transaction in Progress
                        </span>
                      </div>
                      <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                        <div>
                          Status:{" "}
                          {isSendingTx
                            ? `Waiting for ${getWalletName()} approval`
                            : "Transaction confirmed, waiting for blockchain"}
                        </div>
                        <div>Type: {testType.toUpperCase()} transfer</div>
                        <div>
                          Amount: {testAmount} {testType === "fusdt" ? "FUSDT" : "ETH"}
                        </div>
                        <div>To: {testToAddress || "Self"}</div>
                        {txHash && (
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs break-all">
                              Hash: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => utilOpenExplorerLink(chainId, "tx", txHash)}
                              className="h-5 w-5 p-0 text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {isTxConfirmed && (
                    <Alert className="bg-accent/5 border-accent/20">
                      <CheckCircle className="h-4 w-4 text-accent-foreground" />
                      <AlertDescription className="flex items-center justify-between">
                        <span>Transaction confirmed successfully!</span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => txHash && utilOpenExplorerLink(chainId, "tx", txHash)}
                            className="h-6 text-accent-foreground hover:text-accent-foreground/80"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(txHash || "")}
                            className="h-6 text-accent-foreground hover:text-accent-foreground/80"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy Hash
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="signing" className="space-y-6 mt-0">
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
                      disabled={isSigningMessage || isTestingPersonalSign || !testMessage.trim()}
                      variant="outline"
                      className="h-12 flex flex-col gap-1"
                    >
                      {isSigningMessage || isTestingPersonalSign ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-xs">
                            {isSigningMessage ? "Waiting for wallet..." : "Processing..."}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-medium">Personal Sign</span>
                          <span className="text-xs opacity-70">Simple message signing</span>
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={testTypedDataSign}
                      disabled={isSigningTypedData || isTestingTypedData}
                      variant="outline"
                      className="h-12 flex flex-col gap-1"
                    >
                      {isSigningTypedData || isTestingTypedData ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-xs">
                            {isSigningTypedData ? "Waiting for wallet..." : "Processing..."}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-medium">Typed Data</span>
                          <span className="text-xs opacity-70">Structured data signing</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Show signing success feedback */}
                  {testResults.some((result) => result.method === "personal_sign" && result.status === "success") && (
                    <Alert className="bg-accent/5 border-accent/20">
                      <CheckCircle className="h-4 w-4 text-accent-foreground" />
                      <AlertDescription>
                        Message signed successfully! Check the Results tab for the signature.
                      </AlertDescription>
                    </Alert>
                  )}

                  {testResults.some(
                    (result) => result.method === "eth_signTypedData_v4" && result.status === "success",
                  ) && (
                    <Alert className="bg-accent/5 border-accent/20">
                      <CheckCircle className="h-4 w-4 text-accent-foreground" />
                      <AlertDescription>
                        Typed data signed successfully! Check the Results tab for the signature.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="wallet" className="space-y-6 mt-0">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button
                      onClick={testConnectionMethods}
                      disabled={isTestingConnection}
                      variant="outline"
                      className="h-16 p-4 flex flex-col items-center justify-center gap-1 text-center"
                    >
                      {isTestingConnection ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span className="text-xs">Testing...</span>
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-sm">Connection Methods</span>
                          <span className="text-xs text-muted-foreground">Test wallet connection info</span>
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={testReadMethods}
                      disabled={isTestingRead}
                      variant="outline"
                      className="h-16 p-4 flex flex-col items-center justify-center gap-1 text-center"
                    >
                      {isTestingRead ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span className="text-xs">Reading...</span>
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-sm">Read Methods</span>
                          <span className="text-xs text-muted-foreground">Test balance and contract reads</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Show connection and read methods success feedback */}
                  {testResults.some(
                    (result) =>
                      (result.method === "eth_accounts" ||
                        result.method === "eth_chainId" ||
                        result.method === "net_version") &&
                      result.status === "success",
                  ) && (
                    <Alert className="bg-accent/5 border-accent/20">
                      <CheckCircle className="h-4 w-4 text-accent-foreground" />
                      <AlertDescription>
                        Connection methods tested successfully! Check the Results tab for details.
                      </AlertDescription>
                    </Alert>
                  )}

                  {testResults.some(
                    (result) =>
                      (result.method === "eth_getBalance" || result.method === "eth_call") &&
                      result.status === "success",
                  ) && (
                    <Alert className="bg-accent/5 border-accent/20">
                      <CheckCircle className="h-4 w-4 text-accent-foreground" />
                      <AlertDescription>
                        Read methods executed successfully! Check the Results tab for balance details.
                      </AlertDescription>
                    </Alert>
                  )}

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

                  {/* Show chain switch success feedback */}
                  {testResults.some(
                    (result) => result.method === "wallet_switchEthereumChain" && result.status === "success",
                  ) && (
                    <Alert className="bg-accent/5 border-accent/20">
                      <CheckCircle className="h-4 w-4 text-accent-foreground" />
                      <AlertDescription>
                        Chain switched successfully! Check the Results tab for details.
                      </AlertDescription>
                    </Alert>
                  )}

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

              <TabsContent value="results" className="space-y-4 mt-0">
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

                <div className="space-y-2 overflow-y-auto">
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
                                onClick={() => utilOpenExplorerLink(chainId, explorable.type, explorable.value)}
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
