import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { erc20Abi } from "viem";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http("https://eth-sepolia.g.alchemy.com/v2/8SAu08b803dIxRZ1WEhVYX02aiVRkQHX"),
});

/**
 * Get token information from a contract address
 */
export async function getTokenInfo(contractAddress: `0x${string}`) {
  try {
    const [name, symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address: contractAddress,
        abi: erc20Abi,
        functionName: "name",
      }),
      publicClient.readContract({
        address: contractAddress,
        abi: erc20Abi,
        functionName: "symbol",
      }),
      publicClient.readContract({
        address: contractAddress,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    ]);

    return {
      name,
      symbol,
      decimals,
      address: contractAddress,
    };
  } catch (error) {
    console.error("Failed to get token info:", error);
    throw error;
  }
}

/**
 * Get token balance for an address
 */
export async function getTokenBalance(
  contractAddress: `0x${string}`,
  userAddress: `0x${string}`
) {
  try {
    const balance = await publicClient.readContract({
      address: contractAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [userAddress],
    });

    return balance;
  } catch (error) {
    console.error("Failed to get token balance:", error);
    throw error;
  }
}
