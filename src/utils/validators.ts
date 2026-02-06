const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function validateWalletAddress(address: string): string | null {
  const value = address.trim();

  if (!value) {
    return "Wallet address is required.";
  }

  if (!SOLANA_ADDRESS_REGEX.test(value)) {
    return "Enter a valid Solana wallet address (base58, 32-44 chars).";
  }

  return null;
}

export function validateEndpointUrl(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return "RPC endpoint is required.";
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "RPC URL must start with http:// or https://.";
    }
  } catch {
    return "Enter a valid RPC URL.";
  }

  return null;
}
