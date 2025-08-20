import {createConnector} from "@wagmi/core";
import {
  toWebAuthnKey,
  WebAuthnMode,
  toPasskeyValidator,
  PasskeyValidatorContractVersion,
} from "@zerodev/passkey-validator";
import {getEntryPoint, KERNEL_V3_1} from "@zerodev/sdk/constants";
import {UserRejectedRequestError, createPublicClient, http} from "viem";
import {createKernelAccount, createKernelAccountClient} from "@zerodev/sdk";
import {get, set, del} from "idb-keyval";

export interface ZeroDevPasskeyConnectorOptions {
  projectId: string;
  appName?: string;
}

export function createZeroDevPasskeyConnector(options: ZeroDevPasskeyConnectorOptions) {
  const {projectId, appName = "ZeroDev Passkey App"} = options;

  return createConnector((config) => {
    let kernelClient: ReturnType<typeof createKernelAccountClient> | undefined;
    let kernelAccount: Awaited<ReturnType<typeof createKernelAccount>> | undefined;

    // IndexedDB key for persisting WebAuthn key data
    const webAuthnStorageKey = `zerodev-webauthn-${projectId}`;

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
            await this.reconnect();
            config.emitter.emit("connect", {
              accounts: [kernelAccount!.address as `0x${string}`],
              chainId: config.chains[0].id,
            });
          }
        } catch (error) {
          console.warn("Auto-reconnection during setup failed:", error);
          // Clear invalid stored data
          await del(webAuthnStorageKey);
        }
      },

      async connect({chainId} = {}) {
        try {
          const chain = config.chains.find((c) => c.id === chainId) || config.chains[0];
          const entryPoint = getEntryPoint("0.7");

          const publicClient = createPublicClient({
            chain,
            transport: http(),
          });

          // If already connected, return existing account
          if (kernelClient && kernelAccount) {
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
            bundlerTransport: http(`https://rpc.zerodev.app/api/v2/bundler/${projectId}`),
          });

          const result = {
            accounts: [kernelAccount.address as `0x${string}`],
            chainId: chain.id,
          };

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
        // Clear stored WebAuthn key from IndexedDB
        await del(webAuthnStorageKey);

        // Emit disconnect event
        config.emitter.emit("disconnect");
      },

      async reconnect() {
        console.log("Reconnecting with passkey");
        try {
          const chain = config.chains[0];
          const entryPoint = getEntryPoint("0.7");

          const publicClient = createPublicClient({
            chain,
            transport: http(),
          });

          // Try to restore from IndexedDB
          const storedWebAuthnKey = await get(webAuthnStorageKey);
          if (!storedWebAuthnKey) {
            throw new Error("No stored WebAuthn key found for reconnection");
          }

          console.log("Reconnecting with stored WebAuthn key");

          // Create passkey validator with restored key
          const passkeyValidator = await toPasskeyValidator(publicClient, {
            webAuthnKey: storedWebAuthnKey,
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
            bundlerTransport: http(`https://rpc.zerodev.app/api/v2/bundler/${projectId}`),
          });

          console.log("Successfully reconnected with passkey");

          const result = {
            accounts: [kernelAccount.address as `0x${string}`],
            chainId: chain.id,
          };

          // Emit connect event for successful reconnection
          config.emitter.emit("connect", result);

          return result;
        } catch (error) {
          console.error("Failed to reconnect:", error);
          // Clear invalid stored data
          await del(webAuthnStorageKey);
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

    async function createPasskeyOwner() {
      let webAuthnKey;

      try {
        // Try to login with existing passkey first
        webAuthnKey = await toWebAuthnKey({
          passkeyName: appName,
          passkeyServerUrl: `https://passkeys.zerodev.app/api/v3/${projectId}`,
          mode: WebAuthnMode.Login,
          passkeyServerHeaders: {},
        });
      } catch {
        // If login fails, try to register a new passkey
        try {
          webAuthnKey = await toWebAuthnKey({
            passkeyName: appName,
            passkeyServerUrl: `https://passkeys.zerodev.app/api/v3/${projectId}`,
            mode: WebAuthnMode.Register,
            passkeyServerHeaders: {},
          });
        } catch {
          throw new Error("Failed to create or authenticate passkey");
        }
      }

      return webAuthnKey;
    }
  });
}
