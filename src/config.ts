import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { passkeysWalletConnector } from "@/connectors/passkeys-connector";
import { createStorage } from "wagmi";

// Replace with your actual ZeroDev project ID
const ZERODEV_PROJECT_ID = import.meta.env.VITE_ZERODEV_PROJECT_ID;

export const config = createConfig({
  chains: [sepolia],
  connectors: [
    passkeysWalletConnector({
      projectId: ZERODEV_PROJECT_ID,
      appName: "Wagmi Passkeys App",
      passkeyName: "My Wallet", // Default name (users can customize this)
    }),
  ],
  transports: {
    [sepolia.id]: http("https://eth-sepolia.g.alchemy.com/v2/8SAu08b803dIxRZ1WEhVYX02aiVRkQHX"),
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
