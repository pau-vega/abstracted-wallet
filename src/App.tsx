import {useAccount} from "wagmi";
import {Account} from "@/components/account";
import {WalletOptions} from "@/components/wallet-options";
import {Card} from "@/components/ui/card";

function ConnectWallet() {
  const {isConnected} = useAccount();
  if (isConnected) return <Account />;
  return <WalletOptions />;
}

export function App() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4'>
      <Card className='w-full max-w-md bg-white/80 backdrop-blur-sm shadow-xl border-0'>
        <ConnectWallet />
      </Card>
    </div>
  );
}
