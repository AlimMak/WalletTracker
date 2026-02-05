import { useState } from "react";
import { copyTextToClipboard } from "../utils/clipboard";
import { formatSol } from "../utils/format";

interface BalanceCardProps {
  walletAddress: string;
  balanceSol: number | null;
  loading: boolean;
  isCachedData: boolean;
}

export function BalanceCard({
  walletAddress,
  balanceSol,
  loading,
  isCachedData,
}: BalanceCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopyWallet(): Promise<void> {
    if (!walletAddress) {
      return;
    }

    const copied = await copyTextToClipboard(walletAddress);
    if (copied) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } else {
      setCopied(false);
    }
  }

  return (
    <section className="panel">
      <div className="title-row">
        <h2>Current Balance</h2>
        {isCachedData && <span className="pill cached">cached</span>}
      </div>
      <div className="balance-value">
        {loading && balanceSol === null ? "Loading..." : `${formatSol(balanceSol, 9)} SOL`}
      </div>
      <div className="address-row">
        <p className="subtle mono">{walletAddress || "No wallet selected"}</p>
        <button
          type="button"
          className="copy-btn"
          onClick={() => {
            void handleCopyWallet();
          }}
          disabled={!walletAddress}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </section>
  );
}
