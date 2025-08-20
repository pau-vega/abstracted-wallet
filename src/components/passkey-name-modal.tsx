import React, {useState} from "react";

interface PasskeyNameModalProps {
  isOpen: boolean;
  defaultName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function PasskeyNameModal({isOpen, defaultName, onConfirm, onCancel}: PasskeyNameModalProps) {
  const [passkeyName, setPasskeyName] = useState(defaultName);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = passkeyName.trim();
    onConfirm(trimmedName || defaultName);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}>
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "400px",
          width: "90%",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
        }}>
        <h3 style={{margin: "0 0 16px 0", fontSize: "18px", fontWeight: "600"}}>🔐 Name Your Passkey</h3>
        <p style={{margin: "0 0 20px 0", color: "#666", fontSize: "14px", lineHeight: "1.5"}}>
          Choose a name to help you identify this passkey in your password manager and devices.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type='text'
            value={passkeyName}
            onChange={(e) => setPasskeyName(e.target.value)}
            placeholder='My Secure Wallet'
            autoFocus
            style={{
              width: "100%",
              padding: "12px",
              border: "2px solid #e1e5e9",
              borderRadius: "8px",
              fontSize: "16px",
              marginBottom: "20px",
              boxSizing: "border-box",
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#007bff";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#e1e5e9";
            }}
          />

          <div style={{display: "flex", gap: "12px", justifyContent: "flex-end"}}>
            <button
              type='button'
              onClick={onCancel}
              style={{
                padding: "10px 20px",
                border: "2px solid #e1e5e9",
                borderRadius: "6px",
                backgroundColor: "white",
                color: "#666",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
              }}>
              Cancel
            </button>
            <button
              type='submit'
              style={{
                padding: "10px 20px",
                border: "none",
                borderRadius: "6px",
                backgroundColor: "#007bff",
                color: "white",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
              }}>
              Create Passkey
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
