import { createConnector } from "@wagmi/core";
import { toWebAuthnKey, toPasskeyValidator, PasskeyValidatorContractVersion } from "@zerodev/passkey-validator";
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants";
import type { TransactionRequest, EIP1193Parameters, WalletRpcSchema } from "viem";
import { UserRejectedRequestError, createPublicClient, http } from "viem";
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  getUserOperationGasPrice,
} from "@zerodev/sdk";
import { get, set, del } from "idb-keyval";
import type { KernelClient, SessionKeyAccount, WebAuthenticationKey } from "../types/passkeys-connector";
import { WEB_AUTHENTICATION_MODE_KEY } from "../types/passkeys-connector";

export interface PasskeysConnectorOptions {
  projectId: string;
  appName?: string;
  passkeyName?: string;
}

export function passkeysWalletConnector(options: PasskeysConnectorOptions) {
  const { projectId, appName = "Passkeys App", passkeyName } = options;

  const displayName = passkeyName || `${appName} - Passkey`;

  return createConnector((config) => {
    let kernelClient: KernelClient | undefined;
    let kernelAccount: Awaited<SessionKeyAccount> | undefined;
    const passkeyServerUrl = `https://passkeys.zerodev.app/api/v3/${projectId}`;

    const webAuthnStorageKey = `hw-webauthn-${projectId}`;
    const passkeyNameStorageKey = `hw-passkey-name-${projectId}`;

    async function createKernelAccountAndClient(webAuthnKey: Awaited<WebAuthenticationKey>, chainId?: number) {
      const chain = config.chains.find((c) => c.id === chainId) || config.chains[0];
      const bundlerTransport = http(`https://rpc.zerodev.app/api/v3/${projectId}/chain/${chain.id}`);
      const paymasterTransport = http(`https://rpc.zerodev.app/api/v3/${projectId}/chain/${chain.id}`);

      const publicClient = createPublicClient({
        chain,
        transport: bundlerTransport,
        name: "Passkeys",
      });

      const paymasterClient = await createZeroDevPaymasterClient({
        chain,
        transport: paymasterTransport,
      });

      const entryPoint = getEntryPoint("0.7");

      const passkeyValidator = await toPasskeyValidator(publicClient, {
        webAuthnKey,
        entryPoint,
        kernelVersion: KERNEL_V3_1,
        validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2,
      });

      kernelAccount = await createKernelAccount(publicClient, {
        entryPoint,
        kernelVersion: KERNEL_V3_1,
        plugins: { sudo: passkeyValidator },
      });

      kernelClient = createKernelAccountClient({
        account: kernelAccount,
        chain,
        client: publicClient,
        bundlerTransport,
        paymaster: {
          getPaymasterData: async (userOperation) => {
            try {
              console.log("Sponsoring user operation:", userOperation);
              const sponsorResult = await paymasterClient.sponsorUserOperation({ userOperation });
              console.log("Sponsor result:", sponsorResult);
              return sponsorResult;
            } catch (error) {
              console.error("Paymaster sponsorship failed:", error);
              throw error;
            }
          },
        },
        userOperation: {
          estimateFeesPerGas: ({ bundlerClient }) => getUserOperationGasPrice(bundlerClient),
        },
      });

      return {
        accounts: [kernelAccount.address as `0x${string}`],
        chainId: chain.id,
      };
    }

    async function createPasskeyOwner(username: string) {
      try {
        const webAuthnKey = await toWebAuthnKey({
          passkeyName: displayName,
          passkeyServerUrl,
          mode: WEB_AUTHENTICATION_MODE_KEY.LOGIN,
          passkeyServerHeaders: {},
        });

        const existingName = await get(passkeyNameStorageKey);
        if (!existingName) {
          await set(passkeyNameStorageKey, displayName);
        }

        return webAuthnKey;
      } catch {
        try {
          await set(passkeyNameStorageKey, username);

          return await toWebAuthnKey({
            passkeyName: username,
            passkeyServerUrl,
            mode: WEB_AUTHENTICATION_MODE_KEY.REGISTER,
            passkeyServerHeaders: {},
          });
        } catch (error) {
          if (error instanceof Error && error.message.includes("cancelled")) {
            throw new UserRejectedRequestError(error);
          }
          throw new Error("Failed to create or authenticate passkey");
        }
      }
    }

    return {
      id: "wallet-passkey",
      name: "Passkey",
      type: "wallet-passkey" as const,

      async setup() {
        try {
          const storedWebAuthnKey = await get(webAuthnStorageKey);
          if (storedWebAuthnKey && !kernelClient && !kernelAccount) {
            const result = await createKernelAccountAndClient(storedWebAuthnKey);
            config.emitter.emit("connect", result);
          }
        } catch {
          await del(webAuthnStorageKey);
          await del(passkeyNameStorageKey);
        }
      },

      async connect({ chainId } = {}) {
        if (kernelClient && kernelAccount) {
          const chain = config.chains.find((c) => c.id === chainId) || config.chains[0];
          return {
            accounts: [kernelAccount.address as `0x${string}`],
            chainId: chain.id,
          };
        }

        let webAuthnKey;
        try {
          webAuthnKey = await get(webAuthnStorageKey);
          if (!webAuthnKey) throw new Error("No stored WebAuthn key found");
        } catch {
          webAuthnKey = await createPasskeyOwner("username");
          await set(webAuthnStorageKey, webAuthnKey);
        }

        const result = await createKernelAccountAndClient(webAuthnKey, chainId);
        config.emitter.emit("connect", result);
        return result;
      },

      async disconnect() {
        kernelClient = undefined;
        kernelAccount = undefined;
        await del(webAuthnStorageKey);
        await del(passkeyNameStorageKey);
        config.emitter.emit("disconnect");
      },

      async reconnect() {
        const storedWebAuthnKey = await get(webAuthnStorageKey);
        if (!storedWebAuthnKey) {
          throw new Error("No stored WebAuthn key found");
        }
        const result = await createKernelAccountAndClient(storedWebAuthnKey);
        config.emitter.emit("connect", result);
        return result;
      },

      async getAccounts() {
        return kernelAccount ? [kernelAccount.address as `0x${string}`] : [];
      },

      async getChainId() {
        if (!kernelClient?.chain) throw new Error("Kernel client not initialized. Connect first.");

        return kernelClient?.chain.id || config.chains[0]?.id || 1;
      },

      async getProvider() {
        if (!kernelClient || !kernelAccount) {
          throw new Error("Kernel client not initialized. Connect first.");
        }

        return {
          request: async (args: EIP1193Parameters<WalletRpcSchema>) => {
            const { method, params } = args;
            switch (method) {
              case "eth_sendTransaction": {
                if (!kernelClient?.account || !kernelAccount)
                  throw new Error("Kernel client not initialized. Connect first.");
                console.log("eth_sendTransaction", params);
                if (!params || !Array.isArray(params)) {
                  throw new Error("eth_sendTransaction missing transaction parameter");
                }
                const tx = params[0]! as TransactionRequest;
                if (!tx || !tx.to || !tx.data) throw new Error("eth_sendTransaction missing tx params");

                // Encode the call
                const callData = await kernelClient.account.encodeCalls([
                  {
                    to: tx.to,
                    value: tx.value,
                    data: tx.data,
                  },
                ]);
                // Send as user operation
                const userOpHash = await kernelClient.sendUserOperation({ callData });
                // Wait for bundler → actual tx
                const receipt = await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });

                return receipt.receipt.transactionHash;
              }
            }
          },
        };
      },

      async isAuthorized() {
        if (kernelClient && kernelAccount) return true;
        const storedWebAuthnKey = await get(webAuthnStorageKey);
        return !!storedWebAuthnKey;
      },

      async switchChain({ chainId }) {
        const chain = config.chains.find((c) => c.id === chainId);
        if (!chain) {
          throw new Error(`Chain ${chainId} not supported`);
        }
        kernelClient = undefined;
        kernelAccount = undefined;

        // restore session on the new chain
        const storedWebAuthnKey = await get(webAuthnStorageKey);
        if (!storedWebAuthnKey) throw new Error("No stored WebAuthn key");
        await createKernelAccountAndClient(storedWebAuthnKey, chainId);
        config.emitter.emit("change", { chainId });
        return chain;
      },

      onAccountsChanged(accounts) {
        if (accounts.length === 0) {
          config.emitter.emit("disconnect");
        } else {
          config.emitter.emit("change", { accounts: accounts as `0x${string}`[] });
        }
      },

      onChainChanged(chainId) {
        config.emitter.emit("change", { chainId: Number(chainId) });
      },

      onDisconnect() {
        kernelClient = undefined;
        kernelAccount = undefined;
        config.emitter.emit("disconnect");
      },
    };
  });
}
