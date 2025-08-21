import React, {useState} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {KeyRound} from "lucide-react";

interface PasskeyNameModalProps {
  readonly isOpen: boolean;
  readonly defaultName: string;
  readonly onConfirm: (name: string) => void;
  readonly onCancel: () => void;
}

export function PasskeyNameModal({isOpen, defaultName, onConfirm, onCancel}: PasskeyNameModalProps) {
  const [passkeyName, setPasskeyName] = useState(defaultName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = passkeyName.trim();
    onConfirm(trimmedName || defaultName);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader className='text-center space-y-2'>
          <div className='mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2'>
            <KeyRound className='h-6 w-6 text-blue-600' />
          </div>
          <DialogTitle className='text-xl font-bold'>Name Your Passkey</DialogTitle>
          <DialogDescription className='text-muted-foreground'>
            Choose a name to help you identify this passkey in your password manager and devices.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='passkey-name' className='text-sm font-medium'>
              Passkey Name
            </Label>
            <Input
              id='passkey-name'
              type='text'
              value={passkeyName}
              onChange={(e) => setPasskeyName(e.target.value)}
              placeholder='My Secure Wallet'
              autoFocus
              className='w-full'
            />
          </div>

          <DialogFooter className='gap-2 sm:gap-0'>
            <Button type='button' variant='outline' onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type='submit'
              className='bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'>
              <KeyRound className='mr-2 h-4 w-4' />
              Create Passkey
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
