import { createConfig, http } from "wagmi";
import { metaMask } from "wagmi/connectors";
import { sepolia, polygonAmoy } from "wagmi/chains";
import { passkeysWalletConnector } from "@/connectors/passkeys-connector";
import { createStorage } from "wagmi";

// Replace with your actual ZeroDev project ID
const ZERODEV_PROJECT_ID = import.meta.env.VITE_ZERODEV_PROJECT_ID;

export const config = createConfig({
  chains: [sepolia, polygonAmoy], // Sepolia as default, Polygon Amoy as alternative
  connectors: [
    passkeysWalletConnector({
      projectId: ZERODEV_PROJECT_ID,
      appName: "Wagmi Passkeys App",
      passkeyName: "My Wallet", // Default name (users can customize this)
    }),
    metaMask(),
  ],
  transports: {
    [sepolia.id]: http(),
    [polygonAmoy.id]: http("https://rpc-amoy.polygon.technology"),
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
