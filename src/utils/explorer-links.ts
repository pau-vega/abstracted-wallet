import { sepolia, polygonAmoy } from "wagmi/chains";

/**
 * Get the explorer URL for different types of blockchain data
 */
export const getExplorerUrl = (chainId: number, type: "tx" | "address" | "token", value: string): string => {
  const getBaseUrl = (chainId: number): string => {
    switch (chainId) {
      case sepolia.id:
        return "https://sepolia.etherscan.io";
      case polygonAmoy.id:
        return "https://amoy.polygonscan.com";
      default:
        // Default to mainnet etherscan
        return "https://etherscan.io";
    }
  };

  const baseUrl = getBaseUrl(chainId);

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

/**
 * Get the explorer name for a given chain
 */
export const getExplorerName = (chainId: number): string => {
  switch (chainId) {
    case sepolia.id:
      return "Sepolia Etherscan";
    case polygonAmoy.id:
      return "Polygon Amoy Explorer";
    default:
      return "Etherscan";
  }
};

/**
 * Open an explorer URL in a new tab
 */
export const openExplorerLink = (chainId: number, type: "tx" | "address" | "token", value: string): void => {
  const url = getExplorerUrl(chainId, type, value);
  window.open(url, "_blank", "noopener,noreferrer");
};
