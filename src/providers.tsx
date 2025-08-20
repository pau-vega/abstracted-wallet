import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {WagmiProvider} from "wagmi";
import {config} from "./config.ts";

function Providers({children}: {children: React.ReactNode}) {
  const queryClient = new QueryClient();

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export default Providers;
