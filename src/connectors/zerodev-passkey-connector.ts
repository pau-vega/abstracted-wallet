import {createConnector} from "@wagmi/core";
import {toWebAuthnKey, toPasskeyValidator, PasskeyValidatorContractVersion} from "@zerodev/passkey-validator";
import {getEntryPoint, KERNEL_V3_1} from "@zerodev/sdk/constants";
import {UserRejectedRequestError, createPublicClient, http} from "viem";
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  getUserOperationGasPrice,
} from "@zerodev/sdk";
import {get, set, del} from "idb-keyval";
import {promptPasskeyName} from "@/utils/passkey-name-prompt";
import type {KernelClient, SessionKeyAccount, WebAuthenticationKey} from "@/types/human-wallet";
import {WEB_AUTHENTICATION_MODE_KEY} from "@/types/human-wallet";

export interface ZeroDevPasskeyConnectorOptions {
  projectId: string;
  appName?: string;
  passkeyName?: string;
}

export function createZeroDevPasskeyConnector(options: ZeroDevPasskeyConnectorOptions) {
  const {projectId, appName = "Human Wallet Passkey App", passkeyName} = options;

  // Use custom passkey name or fallback to app name with user-friendly suffix
  const displayName = passkeyName || `${appName} - Passkey`;

  return createConnector((config) => {
    let kernelClient: KernelClient | undefined;
    let kernelAccount: Awaited<SessionKeyAccount> | undefined;
    const passkeyServerUrl = `https://passkeys.zerodev.app/api/v3/${projectId}`;

    // IndexedDB keys for persisting WebAuthn key data and passkey name
    const webAuthnStorageKey = `hw-webauthn-${projectId}`;
    const passkeyNameStorageKey = `hw-passkey-name-${projectId}`;

    // Shared function to create kernel account and client
    async function createKernelAccountAndClient(
      webAuthnKey: Awaited<WebAuthenticationKey>,
      chainId?: number
    ): Promise<{
      accounts: `0x${string}`[];
      chainId: number;
    }> {
      const chain = config.chains.find((c) => c.id === chainId) || config.chains[0];
      const bundlerTransport = http(`https://rpc.zerodev.app/api/v3/${projectId}/chain/${chain.id}`);
      const paymasterTransport = http(`https://rpc.zerodev.app/api/v3/${projectId}/chain/${chain.id}`);

      const entryPoint = getEntryPoint("0.7");

      const publicClient = createPublicClient({
        chain,
        transport: bundlerTransport || http(),
        name: "Human Wallet",
      });

      const paymasterClient = await createZeroDevPaymasterClient({
        chain: chain,
        transport: paymasterTransport,
      });

      // Create passkey validator
      const passkeyValidator = await toPasskeyValidator(publicClient, {
        webAuthnKey,
        entryPoint,
        kernelVersion: KERNEL_V3_1,
        validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2,
      });

      // Create kernel account
      kernelAccount = await createKernelAccount(publicClient, {
        entryPoint,
        kernelVersion: KERNEL_V3_1,
        plugins: {
          sudo: passkeyValidator,
        },
      });

      // Create kernel client
      kernelClient = createKernelAccountClient({
        account: kernelAccount,
        chain,
        client: publicClient,
        bundlerTransport: http(`https://rpc.zerodev.app/api/v2/bundler/${projectId}`),
        paymaster: {
          getPaymasterData: (userOperation) => paymasterClient.sponsorUserOperation({userOperation}),
        },
        userOperation: {
          estimateFeesPerGas: ({bundlerClient}) => getUserOperationGasPrice(bundlerClient),
        },
      });

      return {
        accounts: [kernelAccount.address as `0x${string}`],
        chainId: chain.id,
      };
    }

    async function createPasskeyOwner() {
      try {
        // Try to login with existing passkey first
        const webAuthnKey = await toWebAuthnKey({
          passkeyName: displayName,
          passkeyServerUrl,
          mode: WEB_AUTHENTICATION_MODE_KEY.LOGIN,
          passkeyServerHeaders: {},
        });

        // If login is successful, ensure we have a stored passkey name
        const existingName = await get(passkeyNameStorageKey);
        if (!existingName) {
          // Store the default name if no custom name was previously set
          await set(passkeyNameStorageKey, displayName);
          console.log("Stored default passkey name for existing passkey:", displayName);
        }

        return webAuthnKey;
      } catch {
        // If login fails, try to register a new passkey
        try {
          // Prompt user for custom passkey name using modal
          const finalPasskeyName = await promptPasskeyName(displayName);

          // Store the passkey name for later display
          await set(passkeyNameStorageKey, finalPasskeyName);
          console.log("Stored custom passkey name for new passkey:", finalPasskeyName);

          return await toWebAuthnKey({
            passkeyName: finalPasskeyName,
            passkeyServerUrl,
            mode: WEB_AUTHENTICATION_MODE_KEY.REGISTER,
            passkeyServerHeaders: {},
          });
        } catch (error) {
          // If user cancelled or there was an error
          if (error instanceof Error && error.message.includes("cancelled")) {
            throw new UserRejectedRequestError(error);
          }
          throw new Error("Failed to create or authenticate passkey");
        }
      }
    }

    return {
      id: "zerodev-passkey",
      name: "Passkey",
      type: "zerodev-passkey" as const,

      async setup() {
        // Setup method called when connector is first created
        console.log("Setting up ZeroDev Passkey connector");

        // Try to auto-reconnect if we have stored credentials
        try {
          const storedWebAuthnKey = await get(webAuthnStorageKey);
          if (storedWebAuthnKey && !kernelClient && !kernelAccount) {
            console.log("Found stored credentials, attempting auto-reconnection");
            const result = await createKernelAccountAndClient(storedWebAuthnKey);
            config.emitter.emit("connect", result);
          }
        } catch (error) {
          console.warn("Auto-reconnection during setup failed:", error);
          // Clear invalid stored data
          await del(webAuthnStorageKey);
          await del(passkeyNameStorageKey);
        }
      },

      async connect({chainId} = {}) {
        try {
          // If already connected, return existing account
          if (kernelClient && kernelAccount) {
            const chain = config.chains.find((c) => c.id === chainId) || config.chains[0];
            return {
              accounts: [kernelAccount.address as `0x${string}`],
              chainId: chain.id,
            };
          }

          // Try to restore from IndexedDB first
          let webAuthnKey;
          try {
            const storedWebAuthnKey = await get(webAuthnStorageKey);
            if (storedWebAuthnKey) {
              webAuthnKey = storedWebAuthnKey;
              console.log("Restored WebAuthn key from IndexedDB");
            } else {
              throw new Error("No stored WebAuthn key found");
            }
          } catch {
            // Create new passkey if restoration fails
            webAuthnKey = await createPasskeyOwner();

            // Store the WebAuthn key securely in IndexedDB
            await set(webAuthnStorageKey, webAuthnKey);
            console.log("Stored new WebAuthn key in IndexedDB");
          }

          const result = await createKernelAccountAndClient(webAuthnKey, chainId);

          // Emit connect event
          config.emitter.emit("connect", result);

          return result;
        } catch (error) {
          console.error("Failed to connect with passkey:", error);
          if (error instanceof Error && error.message.includes("passkey")) {
            throw new UserRejectedRequestError(error);
          }
          throw error;
        }
      },

      async disconnect() {
        kernelClient = undefined;
        kernelAccount = undefined;
        // Clear stored WebAuthn key and passkey name from IndexedDB
        await del(webAuthnStorageKey);
        await del(passkeyNameStorageKey);

        // Emit disconnect event
        config.emitter.emit("disconnect");
      },

      async reconnect() {
        console.log("Reconnecting with passkey");
        try {
          // Try to restore from IndexedDB
          const storedWebAuthnKey = await get(webAuthnStorageKey);
          if (!storedWebAuthnKey) {
            throw new Error("No stored WebAuthn key found for reconnection");
          }

          console.log("Reconnecting with stored WebAuthn key");

          const result = await createKernelAccountAndClient(storedWebAuthnKey);

          console.log("Successfully reconnected with passkey");

          // Emit connect event for successful reconnection
          config.emitter.emit("connect", result);

          return result;
        } catch (error) {
          console.error("Failed to reconnect:", error);
          // Clear invalid stored data
          await del(webAuthnStorageKey);
          await del(passkeyNameStorageKey);
          throw error;
        }
      },

      async getAccounts() {
        if (!kernelAccount) return [];
        try {
          return [kernelAccount.address as `0x${string}`];
        } catch {
          return [];
        }
      },

      async getChainId() {
        return config.chains[0]?.id || 1;
      },

      async getProvider() {
        return kernelClient;
      },

      async isAuthorized() {
        try {
          console.log("Checking authorization...");

          // Check if we have an active session
          if (kernelClient && kernelAccount) {
            console.log("Already have active session");
            return true;
          }

          // Check if we have a stored WebAuthn key in IndexedDB
          const storedWebAuthnKey = await get(webAuthnStorageKey);
          console.log("Stored WebAuthn key found:", !!storedWebAuthnKey);

          return !!storedWebAuthnKey;
        } catch (error) {
          console.error("Authorization check failed:", error);
          return false;
        }
      },

      async switchChain({chainId}) {
        const chain = config.chains.find((c) => c.id === chainId);
        if (!chain) {
          throw new Error(`Chain ${chainId} not supported`);
        }

        // Reset to reinitialize with new chain
        kernelClient = undefined;
        kernelAccount = undefined;

        return chain;
      },

      onAccountsChanged(accounts) {
        if (accounts.length === 0) {
          config.emitter.emit("disconnect");
        } else {
          config.emitter.emit("change", {accounts: accounts as `0x${string}`[]});
        }
      },

      onChainChanged(chainId) {
        config.emitter.emit("change", {chainId: Number(chainId)});
      },

      onDisconnect() {
        kernelClient = undefined;
        kernelAccount = undefined;
        config.emitter.emit("disconnect");
      },
    };
  });
}
