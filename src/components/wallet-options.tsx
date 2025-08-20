import * as React from "react";
import {Connector, useConnect} from "wagmi";

export function WalletOptions() {
  const {connectors, connect, isPending, error} = useConnect();

  return (
    <div style={{display: "flex", flexDirection: "column", gap: "12px", padding: "20px", maxWidth: "300px"}}>
      <h2>Connect with Passkey</h2>
      <p style={{fontSize: "14px", color: "#666"}}>
        Use your device's biometric authentication (fingerprint, face ID, or security key) to securely connect.
      </p>

      {connectors.map((connector) => (
        <WalletOption
          key={connector.uid}
          connector={connector}
          onClick={() => connect({connector})}
          isPending={isPending}
        />
      ))}

      {error && (
        <div
          style={{
            color: "red",
            fontSize: "14px",
            marginTop: "8px",
            padding: "8px",
            backgroundColor: "#fee",
            borderRadius: "4px",
          }}>
          <strong>Connection Error:</strong> {error.message}
          {error.message.includes("Unsupported entry point") && (
            <div style={{marginTop: "4px", fontSize: "12px"}}>
              Try checking your ZeroDev project settings or contact support if this persists.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WalletOption({
  connector,
  onClick,
  isPending,
}: {
  connector: Connector;
  onClick: () => void;
  isPending: boolean;
}) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      // For passkey connectors, they're ready by default since they don't need a pre-existing provider
      if (connector.name === "Passkey") {
        setReady(true);
        return;
      }

      // For other connectors, check if provider is available
      try {
        const provider = await connector.getProvider();
        setReady(!!provider);
      } catch (error) {
        console.warn(`Failed to get provider for ${connector.name}:`, error);
        setReady(false);
      }
    })();
  }, [connector]);

  const isPasskey = connector.name === "Passkey";

  return (
    <button
      disabled={!ready || isPending}
      onClick={onClick}
      style={{
        padding: "12px 16px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        backgroundColor: isPasskey ? "#007AFF" : "#f8f9fa",
        color: isPasskey ? "white" : "#333",
        cursor: !ready || isPending ? "not-allowed" : "pointer",
        opacity: !ready || isPending ? 0.6 : 1,
        transition: "all 0.2s ease",
        fontSize: "16px",
        fontWeight: isPasskey ? "600" : "normal",
      }}>
      {isPending ? (
        "Connecting..."
      ) : (
        <>
          {isPasskey ? "🔐 " : ""}
          {connector.name}
          {!ready && " (Loading...)"}
        </>
      )}
    </button>
  );
}
