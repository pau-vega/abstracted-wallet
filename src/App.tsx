import {useAccount} from "wagmi";
import {Account} from "./components/account";
import {WalletOptions} from "./components/wallet-options";

function ConnectWallet() {
  const {isConnected} = useAccount();
  if (isConnected) return <Account />;
  return <WalletOptions />;
}

function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f5f5f5",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}>
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
          minWidth: "320px",
        }}>
        <ConnectWallet />
      </div>
    </div>
  );
}

export default App;
