import {useState, useEffect} from "react";
import {useAccount} from "wagmi";
import {getStoredPasskeyName} from "@/utils/get-passkey-name";

/**
 * Hook to get the stored passkey name for the connected account
 */
export function usePasskeyName(): string | null {
  const [passkeyName, setPasskeyName] = useState<string | null>(null);
  const {connector, isConnected} = useAccount();

  useEffect(() => {
    async function loadPasskeyName() {
      if (!isConnected || !connector || connector.name !== "Passkey") {
        setPasskeyName(null);
        return;
      }

      try {
        // Extract project ID from connector - this is a bit hacky but works
        // In a real app, you might want to expose this through the connector
        const projectId = "b51cdaae-10d4-4ef5-b693-4e5c6a0fbc56"; // Your ZeroDev project ID
        const name = await getStoredPasskeyName(projectId);
        setPasskeyName(name);
        
        // Debug log to see what we're getting
        console.log("Loaded passkey name:", name);
      } catch (error) {
        console.warn("Failed to load passkey name:", error);
        setPasskeyName(null);
      }
    }

    loadPasskeyName();
  }, [isConnected, connector]);

  return passkeyName;
}
