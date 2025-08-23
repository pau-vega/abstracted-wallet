import { useAccount } from "wagmi";
import { Account } from "@/components/account";
import { WalletOptions } from "@/components/wallet-options";
import { Card } from "@/components/ui/card";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { Toaster } from "@/components/ui/sonner";

function ConnectWallet() {
  const { isConnected } = useAccount();
  if (isConnected) return <Account />;
  return <WalletOptions />;
}

export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="wagmi-passkeys-theme">
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 transition-colors">
        <Card className="relative w-full max-w-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-xl border-0 dark:border dark:border-slate-700">
          {/* Theme toggle positioned at top right of the card */}
          <div className="absolute top-3 right-3 z-10">
            <ModeToggle />
          </div>

          <ConnectWallet />
        </Card>
      </div>
      <Toaster />
    </ThemeProvider>
  );
}
