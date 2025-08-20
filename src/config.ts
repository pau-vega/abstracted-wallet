import {createConfig, http} from "wagmi";
import {sepolia} from "wagmi/chains";
import {createZeroDevPasskeyConnector} from "./connectors/zerodev-passkey-connector";
import {createStorage} from "wagmi";

// Replace with your actual ZeroDev project ID
const ZERODEV_PROJECT_ID = "b51cdaae-10d4-4ef5-b693-4e5c6a0fbc56";

export const config = createConfig({
  chains: [sepolia],
  connectors: [
    createZeroDevPasskeyConnector({
      projectId: ZERODEV_PROJECT_ID,
      appName: "Wagmi Passkeys App",
    }),
  ],
  transports: {
    [sepolia.id]: http(),
  },
  // Enable session persistence with localStorage
  storage: createStorage({
    storage: localStorage,
    key: "zerodev-wagmi",
  }),
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
