import { get } from "idb-keyval";

/**
 * Gets the stored passkey name for the given project ID
 */
export async function getStoredPasskeyName(projectId: string): Promise<string | null> {
  try {
    const passkeyNameStorageKey = `zerodev-passkey-name-${projectId}`;
    const storedName = await get(passkeyNameStorageKey);
    return storedName || null;
  } catch (error) {
    console.warn("Failed to retrieve stored passkey name:", error);
    return null;
  }
}
