import type { UiTokenBalanceRow } from "../api/solanaRpc";
import { truncateMiddle } from "../utils/format";

interface TokenBalancesProps {
  rows: UiTokenBalanceRow[];
  loading: boolean;
  errorMessage: string | null;
  isCachedData: boolean;
}

export function TokenBalances({
  rows,
  loading,
  errorMessage,
  isCachedData,
}: TokenBalancesProps) {
  return (
    <section className="panel">
      <div className="section-head">
        <div className="title-row">
          <h2>Token Balances</h2>
          {isCachedData && <span className="pill cached">cached</span>}
        </div>
      </div>

      {errorMessage && (
        <p className="warning-text">
          Unable to refresh token balances: {errorMessage}
        </p>
      )}

      {loading && rows.length === 0 && <p className="subtle">Loading token balances...</p>}

      {!loading && rows.length === 0 && !errorMessage && (
        <p className="subtle">No SPL token balances found for this wallet.</p>
      )}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="token-table">
            <thead>
              <tr>
                <th>Mint</th>
                <th>Amount</th>
                <th>Decimals</th>
                <th>Accounts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.mint}>
                  <td className="mono" title={row.mint}>
                    {truncateMiddle(row.mint, 12, 12)}
                  </td>
                  <td>{row.amount}</td>
                  <td>{row.decimals}</td>
                  <td>{row.accountCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
