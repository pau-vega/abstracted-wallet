import {useAccount} from "wagmi";
import {Account} from "./components/account";
import {WalletOptions} from "./components/wallet-options";

function ConnectWallet() {
  const {isConnected} = useAccount();
  if (isConnected) return <Account />;
  return <WalletOptions />;
}

function App() {
  return <ConnectWallet />;
}

export default App;
