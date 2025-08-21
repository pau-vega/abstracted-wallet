import * as React from "react";
import {Connector, useConnect} from "wagmi";
import {CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Alert, AlertDescription} from "@/components/ui/alert";
import {KeyRound, AlertCircle} from "lucide-react";

export function WalletOptions() {
  const {connectors, connect, isPending, error} = useConnect();

  return (
    <>
      <CardHeader className='text-center space-y-2'>
        <div className='mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2'>
          <KeyRound className='h-6 w-6 text-blue-600' />
        </div>
        <CardTitle className='text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'>
          Connect with Passkey
        </CardTitle>
        <CardDescription className='text-muted-foreground'>
          Use your device's biometric authentication (fingerprint, face ID, or security key) to securely connect.
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-4'>
        {connectors.map((connector) => (
          <WalletOption
            key={connector.uid}
            connector={connector}
            onClick={() => connect({connector})}
            isPending={isPending}
          />
        ))}

        {error && (
          <Alert variant='destructive'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>
              <strong>Connection Error:</strong> {error.message}
              {error.message.includes("Unsupported entry point") && (
                <div className='mt-1 text-sm'>
                  Try checking your ZeroDev project settings or contact support if this persists.
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </>
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
    <Button
      disabled={!ready || isPending}
      onClick={onClick}
      variant={isPasskey ? "default" : "outline"}
      size='lg'
      className={`w-full ${
        isPasskey
          ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
          : "hover:bg-muted"
      }`}>
      {isPending ? (
        <>
          <div className='mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
          Connecting...
        </>
      ) : (
        <>
          {isPasskey && <KeyRound className='mr-2 h-4 w-4' />}
          {connector.name}
          {!ready && " (Loading...)"}
        </>
      )}
    </Button>
  );
}
