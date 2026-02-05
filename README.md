# Solana Wallet Tracker (Frontend Only)

Small React + TypeScript app (Vite) to track a Solana wallet using public JSON-RPC endpoints.

## 1) Setup

1. Ensure Node.js 18+ is installed.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start local dev server:
   ```bash
   npm run dev
   ```
4. Open the local URL printed by Vite (usually `http://localhost:5173`).

## 2) Build

```bash
npm run build
```

## 3) Project structure

```text
src/
  api/solanaRpc.ts
  utils/format.ts
  components/
    WalletForm.tsx
    BalanceCard.tsx
    TxTable.tsx
  App.tsx
  main.tsx
```

## 4) Notes

- Default endpoint is mainnet-beta (`https://api.mainnet-beta.solana.com`).
- App uses `getBalance`, `getSignaturesForAddress`, then `getTransaction` with a concurrency cap.
- If transaction details are missing or fail, row fields fall back to `unknown` (best effort, no guessing).
