import { useState, useCallback, useEffect, useRef } from "react";
import {
  isConnected,
  getAddress,
  requestAccess,
} from "@stellar/freighter-api";

/** How often to poll Freighter for connection status while a wallet is connected (ms). */
const POLL_INTERVAL_MS = 3_000;

export type WalletStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected";

export interface UseWalletReturn {
  /** The connected Stellar public key, or null when not connected. */
  address: string | null;
  /** Current connection status. */
  status: WalletStatus;
  /** Human-readable error message, if any. */
  error: string | null;
  /** Whether the reconnect prompt should be shown. */
  showReconnectPrompt: boolean;
  /** Initiate wallet connection (also used for manual reconnect). */
  connect: () => Promise<void>;
  /** Clear wallet state and stop polling. */
  disconnect: () => void;
  /** Dismiss the reconnect prompt without reconnecting. */
  dismissReconnectPrompt: () => void;
}

export function useWallet(): UseWalletReturn {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showReconnectPrompt, setShowReconnectPrompt] = useState(false);

  // Keep a ref to the polling interval so we can clear it from any closure.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  /**
   * Poll Freighter to detect session expiry / wallet disconnection.
   * Runs every POLL_INTERVAL_MS while a wallet address is held in state.
   */
  const startPolling = useCallback((connectedAddress: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const connected = await isConnected();
        if (!connected) {
          // Wallet extension disconnected or session timed out
          handleDisconnectDetected();
          return;
        }
        // Double-check the address hasn't changed (e.g. user switched accounts)
        const { address: currentAddr } = await getAddress();
        if (currentAddr !== connectedAddress) {
          // Account changed — treat as a disconnect so the UI reflects reality
          handleDisconnectDetected();
        }
      } catch {
        // Network/extension error — treat as disconnected
        handleDisconnectDetected();
      }
    }, POLL_INTERVAL_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Called whenever we detect the wallet is no longer available. */
  function handleDisconnectDetected() {
    stopPolling();
    setAddress(null);
    setStatus("disconnected");
    setShowReconnectPrompt(true);
  }

  /** Attempt to reconnect automatically if the Freighter extension is still
   *  available (e.g. the session just timed out but the extension is installed). */
  const autoReconnect = useCallback(async () => {
    try {
      const connected = await isConnected();
      if (!connected) return; // Extension gone — nothing to do
      // Extension is available but session expired; re-request access silently.
      await requestAccess();
      const { address: addr } = await getAddress();
      if (addr) {
        setAddress(addr);
        setStatus("connected");
        setShowReconnectPrompt(false);
        setError(null);
        startPolling(addr);
      }
    } catch {
      // Auto-reconnect failed silently — prompt remains visible
    }
  }, [startPolling]);

  // When status becomes 'disconnected', attempt a silent auto-reconnect.
  useEffect(() => {
    if (status === "disconnected") {
      autoReconnect();
    }
  }, [status, autoReconnect]);

  // Clean up the polling interval on unmount.
  useEffect(() => {
    return () => stopPolling();
  }, []);

  /** Manually connect (or reconnect) the wallet. */
  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    setShowReconnectPrompt(false);
    try {
      const connected = await isConnected();
      if (!connected) {
        setError("Freighter extension not found. Please install it.");
        setStatus("idle");
        return;
      }
      await requestAccess();
      const { address: addr } = await getAddress();
      setAddress(addr);
      setStatus("connected");
      startPolling(addr);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to connect wallet";
      setError(message);
      setStatus("idle");
    }
  }, [startPolling]);

  /** Explicitly disconnect and stop polling. */
  const disconnect = useCallback(() => {
    stopPolling();
    setAddress(null);
    setStatus("idle");
    setError(null);
    setShowReconnectPrompt(false);
  }, []);

  /** Dismiss the reconnect prompt (user chooses not to reconnect). */
  const dismissReconnectPrompt = useCallback(() => {
    setShowReconnectPrompt(false);
    setStatus("idle");
  }, []);

  return {
    address,
    status,
    error,
    showReconnectPrompt,
    connect,
    disconnect,
    dismissReconnectPrompt,
  };
}
