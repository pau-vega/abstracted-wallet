import type {createKernelAccountClient, CreateKernelAccountReturnType, ZeroDevPaymasterClient} from "@zerodev/sdk";
import {WebAuthnMode, type WebAuthnKey} from "@zerodev/webauthn-key";

export type PaymasterClient = ZeroDevPaymasterClient;

export type KernelClient = ReturnType<typeof createKernelAccountClient>;

export type SessionKeyAccount = CreateKernelAccountReturnType<"0.7">;

export type WebAuthenticationKey = WebAuthnKey;

export type WebAuthenticationModeKey = WebAuthnMode;

export const WEB_AUTHENTICATION_MODE_KEY = {
  REGISTER: WebAuthnMode.Register,
  LOGIN: WebAuthnMode.Login,
} as const;
