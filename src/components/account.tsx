import {useAccount, useDisconnect, useEnsAvatar, useEnsName} from "wagmi";
import {usePasskeyName} from "../hooks/use-passkey-name";

export function Account() {
  const {address, connector} = useAccount();
  const {disconnect} = useDisconnect();
  const {data: ensName} = useEnsName({address});
  const {data: ensAvatar} = useEnsAvatar({name: ensName!});
  const passkeyName = usePasskeyName();

  const isPasskey = connector?.name === "Passkey";

  return (
    <div style={{padding: "20px", maxWidth: "400px", margin: "0 auto"}}>
      <div style={{marginBottom: "20px", textAlign: "center"}}>
        <h2>🎉 Connected Successfully!</h2>
        {isPasskey && (
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "#e8f5e8",
              border: "1px solid #4CAF50",
              borderRadius: "6px",
              marginBottom: "16px",
              fontSize: "14px",
              color: "#2e7d32",
            }}>
            🔐 Secured with Passkey Authentication
            {passkeyName && <div style={{marginTop: "4px", fontWeight: "600"}}>Passkey: "{passkeyName}"</div>}
          </div>
        )}
      </div>

      <div style={{marginBottom: "20px"}}>
        {ensAvatar && (
          <img
            alt='ENS Avatar'
            src={ensAvatar}
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              display: "block",
              margin: "0 auto 12px",
            }}
          />
        )}

        <div
          style={{
            backgroundColor: "#f8f9fa",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #e9ecef",
            marginBottom: "12px",
          }}>
          <div style={{fontSize: "12px", color: "#666", marginBottom: "4px"}}>Smart Account Address:</div>
          <div style={{fontFamily: "monospace", fontSize: "14px", wordBreak: "break-all"}}>{address}</div>
          {ensName && <div style={{fontSize: "14px", color: "#007AFF", marginTop: "4px"}}>ENS: {ensName}</div>}
        </div>

        {connector && (
          <div style={{fontSize: "14px", color: "#666", marginBottom: "16px"}}>Connected via: {connector.name}</div>
        )}
      </div>

      <button
        onClick={() => disconnect()}
        style={{
          width: "100%",
          padding: "12px 16px",
          border: "1px solid #dc3545",
          borderRadius: "8px",
          backgroundColor: "#dc3545",
          color: "white",
          cursor: "pointer",
          fontSize: "16px",
          fontWeight: "600",
          transition: "background-color 0.2s ease",
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#c82333")}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#dc3545")}>
        Disconnect
      </button>
    </div>
  );
}
