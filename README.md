# Solana Wallet Tracker (Frontend Only)

Production-quality dark dashboard for tracking a Solana wallet from public JSON-RPC endpoints.

## Stack

- React + TypeScript (Vite)
- Tailwind CSS
- Frontend-only RPC calls (`getBalance`, `getSignaturesForAddress`, `getTransaction`)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

3. Build production assets:

```bash
npm run build
```

4. Preview production build:

```bash
npm run preview
```

## Required folder structure

```text
src/
  api/
    solanaRpc.ts
    concurrency.ts
  utils/
    format.ts
    validators.ts
  components/
    Header.tsx
    WalletForm.tsx
    SettingsPanel.tsx
    BalanceCard.tsx
    KpiRow.tsx
    TxTable.tsx
    Toast.tsx
  App.tsx
  main.tsx
  index.css
```

## Direction + SOL delta inference

For each fetched signature, the app requests `getTransaction` and then:

1. Finds `walletIndex` in `transaction.message.accountKeys` matching the tracked wallet.
2. If index exists and `meta.preBalances` + `meta.postBalances` are present:
   - `lamportDelta = postBalances[walletIndex] - preBalances[walletIndex]`
   - `solChange = lamportDelta / 1e9`
   - direction:
     - `solChange > 0` => incoming
     - `solChange < 0` => outgoing
     - `solChange === 0` => unknown
3. If metadata is missing, `solChange = null` and direction = unknown.
4. Status:
   - `meta.err === null` => success
   - `meta.err` exists => fail
   - otherwise unknown
5. Fee from `meta.fee / 1e9` when available.

## Known limitations

- Direction and SOL delta are wallet-native balance deltas only; they do not classify token swaps/bridges semantically.
- `getTransaction` can return `null` on some RPC nodes or old slots, shown as `detail unavailable`.
- Public RPC endpoints may rate limit; use lower concurrency or another endpoint when degraded.
