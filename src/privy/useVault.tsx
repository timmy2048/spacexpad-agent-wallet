import { useEffect, useRef } from 'react';
import {
  PrivyProvider,
  useCreateWallet,
  useLoginWithEmail,
  useLoginWithOAuth,
  useLogout,
  usePrivy,
  useWallets,
  type ConnectedWallet,
  type User,
} from '@privy-io/react-auth';
import { useCreateWallet as useCreateSolanaWallet, useSignTransaction, useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { createPublicClient, createWalletClient, custom, http, type Hex } from 'viem';
import { base, baseSepolia, bsc, bscTestnet, mainnet, sepolia } from 'viem/chains';
import { resolveCluster } from '../../shared/chains.ts';
import { evmCallFromSerialized } from '../../shared/evmIntent.ts';
import { parseDecimal } from '../../shared/money.ts';
import { embeddedPresence, missingEmbeddedWallets } from '../../shared/wallets.ts';
import { updateStore } from '../lib/storage.ts';
import type { SignOutcome } from '../lib/handleRequest.ts';
import { buildSolTransfer, decodeSerialized, encodeBase64, sendSignedSol } from '../lib/solanaTx.ts';
import type { TxParams } from '../../shared/types.ts';

const EVM_CHAINS = [mainnet, sepolia, base, baseSepolia, bsc, bscTestnet];

export function PrivyGate({
  appId,
  clientId,
  children,
}: {
  appId: string;
  clientId: string;
  children: React.ReactNode;
}) {
  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId || undefined}
      config={{
        loginMethods: ['email', 'google'],
        appearance: { theme: 'dark', accentColor: '#38bdf8' },
        embeddedWallets: {
          showWalletUIs: false,
          // Dashboard "create on login" only runs for the Privy modal.
          // Email and Google here are whitelabel calls, so creation is explicit below.
          ethereum: { createOnLogin: 'off' },
          solana: { createOnLogin: 'off' },
        },
        supportedChains: EVM_CHAINS,
      }}
    >
      {children}
    </PrivyProvider>
  );
}

export function useVault() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const solana = useSolanaWallets();
  const { createWallet } = useCreateWallet();
  const { createWallet: createSolana } = useCreateSolanaWallet();
  const { signTransaction } = useSignTransaction();
  const emailLogin = useLoginWithEmail();
  const googleLogin = useLoginWithOAuth();
  const { logout } = useLogout();
  const inFlight = useRef(false);
  const attemptKey = useRef('');
  const profileKey = useRef('');
  const seenAddresses = useRef('');

  useEffect(() => {
    if (!ready || !authenticated || !user || inFlight.current) return;
    const presence = embeddedPresence(user.linkedAccounts ?? []);
    if (wallets.some((wallet) => wallet.walletClientType === 'privy' || wallet.walletClientType === 'privy-v2')) {
      presence.ethereum = true;
    }
    if (solana.wallets.length > 0) presence.solana = true;
    const missing = missingEmbeddedWallets(presence);
    if (missing.length === 0) return;
    const key = `${user.id}:${missing.join(',')}`;
    if (attemptKey.current === key) return;
    attemptKey.current = key;
    inFlight.current = true;
    void (async () => {
      try {
        if (missing.includes('ethereum')) {
          try {
            await createWallet();
          } catch (error) {
            if (!alreadyHasWallet(error)) throw error;
          }
        }
        if (missing.includes('solana')) {
          try {
            await createSolana();
          } catch (error) {
            if (!alreadyHasWallet(error)) throw error;
          }
        }
        await updateStore((store) => ({ ...store, vaultError: null }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The vault could not be created.';
        await updateStore((store) => ({ ...store, vaultError: message }));
      } finally {
        inFlight.current = false;
      }
    })();
  }, [authenticated, createSolana, createWallet, ready, solana.wallets, user, wallets]);

  useEffect(() => {
    if (!authenticated || !user) return;
    const email = readEmail(user);
    const key = `${user.id}:${email}`;
    if (profileKey.current === key) return;
    profileKey.current = key;
    void updateStore((store) => {
      const switched = Boolean(store.auth && store.auth.userId !== user.id);
      return {
        ...store,
        auth: { userId: user.id, email },
        username: switched ? seedUsername(email) : store.username || seedUsername(email),
        agents: switched ? [] : store.agents,
        snapshots: switched ? [] : store.snapshots,
        activity: switched ? [] : store.activity,
        pair: switched ? null : store.pair,
        addresses: switched ? null : store.addresses,
      };
    });
  }, [authenticated, user]);

  useEffect(() => {
    const evm = wallets.find((wallet) => wallet.walletClientType === 'privy')?.address ?? wallets[0]?.address ?? null;
    const solanaAddress = solana.wallets[0]?.address ?? null;
    const key = `${evm ?? ''}:${solanaAddress ?? ''}`;
    if (!evm && !solanaAddress) return;
    if (seenAddresses.current === key) return;
    seenAddresses.current = key;
    void updateStore((store) => ({ ...store, addresses: { evm, solana: solanaAddress } }));
  }, [solana.wallets, wallets]);

  const walletsRef = useRef(wallets);
  const solanaRef = useRef(solana.wallets);
  walletsRef.current = wallets;
  solanaRef.current = solana.wallets;
  const signSolRef = useRef(signTransaction);
  signSolRef.current = signTransaction;

  const sign = async (params: TxParams, rpcUrl: string, method: 'sign' | 'send'): Promise<SignOutcome> => {
    if (params.chain === 'solana') {
      const wallet = solanaRef.current[0];
      if (!wallet) throw new Error('No Solana wallet is available.');
      const bytes =
        params.kind === 'native_transfer'
          ? await buildSolTransfer(rpcUrl, wallet.address, params.to ?? '', parseDecimal(params.amount ?? '', 9))
          : decodeSerialized(params.serialized ?? '');
      const signed = await signSolRef.current({
        transaction: bytes,
        wallet,
        chain: params.network === 'devnet' ? 'solana:devnet' : 'solana:mainnet',
      });
      const signedTransaction = encodeBase64(signed.signedTransaction);
      if (method === 'sign') return { signedTransaction };
      const hash = await sendSignedSol(rpcUrl, signed.signedTransaction);
      return { hash, signedTransaction };
    }
    return signEvm(params, rpcUrl, method, walletsRef.current);
  };

  return { ready, authenticated, user, emailLogin, googleLogin, logout, sign };
}

async function signEvm(
  params: TxParams,
  rpcUrl: string,
  method: 'sign' | 'send',
  wallets: ConnectedWallet[],
): Promise<SignOutcome> {
  const cluster = resolveCluster(params.chain, params.network);
  if (cluster.chainId === null) throw new Error('Not an EVM chain.');
  const wallet = wallets.find((item) => item.walletClientType === 'privy') ?? wallets[0];
  if (!wallet) throw new Error('No Ethereum wallet is available.');
  await wallet.switchChain(cluster.chainId);
  const found = EVM_CHAINS.find((item) => item.id === cluster.chainId);
  if (!found) throw new Error(`Chain ${cluster.chainId} is not configured.`);
  const chain = {
    ...found,
    rpcUrls: { ...found.rpcUrls, default: { ...found.rpcUrls.default, http: [rpcUrl] } },
  };
  const provider = await wallet.getEthereumProvider();
  const account = wallet.address as Hex;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: custom(provider) });
  const call =
    params.kind === 'native_transfer'
      ? {
          to: params.to as Hex,
          value: parseDecimal(params.amount ?? '', 18),
          data: '0x' as Hex,
        }
      : serializedEvmCall(params.serialized ?? '');
  if (!call.to) throw new Error('This transaction has no destination.');
  const fees = await publicClient.estimateFeesPerGas();
  const gas = await publicClient.estimateGas({ account, to: call.to, value: call.value, data: call.data });
  const nonce = await publicClient.getTransactionCount({ address: account });
  try {
    const signed = await walletClient.signTransaction({
      account,
      to: call.to,
      value: call.value,
      data: call.data,
      gas,
      nonce,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      chain,
    });
    if (method === 'sign') return { signedTransaction: signed };
    const hash = await publicClient.sendRawTransaction({ serializedTransaction: signed });
    return { hash, signedTransaction: signed };
  } catch (error) {
    if (method === 'sign') {
      throw error instanceof Error ? error : new Error('The wallet could not sign this transaction.');
    }
    const hash = await walletClient.sendTransaction({
      account,
      chain,
      to: call.to,
      value: call.value,
      data: call.data,
    });
    return { hash };
  }
}

function serializedEvmCall(serialized: string): { to: Hex | null; value: bigint; data: Hex } {
  const call = evmCallFromSerialized(serialized);
  return { to: call.to, value: call.value, data: call.data };
}

function alreadyHasWallet(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /already/i.test(text);
}

function readEmail(user: User): string {
  for (const account of user.linkedAccounts ?? []) {
    if (account.type === 'email' && 'address' in account && account.address) return account.address;
    if (account.type === 'google_oauth' && 'email' in account && account.email) return account.email;
  }
  return '';
}

function seedUsername(email: string): string {
  const local = email.split('@')[0] ?? '';
  const cleaned = local.replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 24);
  return cleaned.length >= 2 ? cleaned : 'wallet';
}
