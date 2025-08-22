import { createRoot } from "react-dom/client";
import { PasskeyNameModal } from "@/components/passkey-name-modal";
import { createElement } from "react";

/**
 * Shows a modal dialog to prompt user for passkey name
 */
export function promptPasskeyName(defaultName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create container element
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    // Cleanup function
    const cleanup = () => {
      root.unmount();
      document.body.removeChild(container);
    };

    // Handle confirm
    const handleConfirm = (name: string) => {
      cleanup();
      resolve(name);
    };

    // Handle cancel
    const handleCancel = () => {
      cleanup();
      reject(new Error("User cancelled passkey name input"));
    };

    // Render modal
    root.render(
      createElement(PasskeyNameModal, {
        isOpen: true,
        defaultName,
        onConfirm: handleConfirm,
        onCancel: handleCancel,
      }),
    );
  });
}
