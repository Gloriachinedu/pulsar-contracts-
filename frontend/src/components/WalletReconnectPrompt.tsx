import React from "react";

interface WalletReconnectPromptProps {
  /** Called when the user clicks "Reconnect". */
  onReconnect: () => void;
  /** Called when the user dismisses the prompt. */
  onDismiss: () => void;
}

/**
 * Banner shown when the connected wallet session has expired or the wallet
 * has been disconnected. Prompts the user to reconnect or dismiss.
 */
export function WalletReconnectPrompt({
  onReconnect,
  onDismiss,
}: WalletReconnectPromptProps) {
  return (
    <div
      role="alert"
      className="rounded-md bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 p-3 flex items-center justify-between gap-4 text-sm text-yellow-800 dark:text-yellow-200"
    >
      <span>
        ⚠️ Your wallet session has expired. Please reconnect to continue.
      </span>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onReconnect}
          className="rounded bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 text-xs font-medium transition-colors"
        >
          Reconnect
        </button>
        <button
          onClick={onDismiss}
          className="rounded border border-yellow-400 dark:border-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 px-3 py-1 text-xs transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
