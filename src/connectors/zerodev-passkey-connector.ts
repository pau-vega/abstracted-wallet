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

export interface ZeroDevPasskeyConnectorOptions {
  projectId: string;
  appName?: string;
}

export function createZeroDevPasskeyConnector(options: ZeroDevPasskeyConnectorOptions) {
  const {projectId, appName = "ZeroDev Passkey App"} = options;

  return createConnector((config) => {
    let kernelClient: ReturnType<typeof createKernelAccountClient> | undefined;
    let kernelAccount: Awaited<ReturnType<typeof createKernelAccount>> | undefined;

    return {
      id: "zerodev-passkey",
      name: "Passkey",
      type: "zerodev-passkey" as const,

      async connect({chainId} = {}) {
        try {
          const chain = config.chains.find((c) => c.id === chainId) || config.chains[0];
          const entryPoint = getEntryPoint("0.7");

          const publicClient = createPublicClient({
            chain,
            transport: http(),
          });

          // Create passkey validator
          const webAuthnKey = await createPasskeyOwner();
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

          return {
            accounts: [kernelAccount.address as `0x${string}`],
            chainId: chain.id,
          };
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
          return !!(kernelClient && kernelAccount);
        } catch {
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
