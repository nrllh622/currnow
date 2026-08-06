// cryptoList.ts
// MyNestVault — Genişletilmiş kripto listesi (v1.1)
//
// BTC ve ETH kendi ayrı varlık tipleri olarak KALIR (eski kayıtlar bozulmasın).
// Bu liste "Kripto" tipi altında seçilebilen ~30 popüler coini tanımlar.
// Fiyatlar CoinGecko keyless simple/price ucundan TEK çağrıyla çekilir:
//   https://api.coingecko.com/api/v3/simple/price?ids=<id,id,...>&vs_currencies=usd
//
// Yeni coin eklemek = bu listeye bir satır eklemek. Kod değişikliği gerekmez.
// coingeckoId alanı CoinGecko'nun resmi id'si olmalı (sembol değil!).

export interface CryptoCoin {
  /** CoinGecko API id'si — fiyat çağrısında kullanılır (örn 'bitcoin') */
  coingeckoId: string;
  /** Kısa sembol — arayüzde ve arama için (örn 'BTC') */
  symbol: string;
  /** Görünen ad (örn 'Bitcoin') */
  name: string;
}

// En çok işlem gören ~30 coin (piyasa değeri ve hacim önceliğine göre)
export const CRYPTO_COINS: CryptoCoin[] = [
  { coingeckoId: 'bitcoin',        symbol: 'BTC',   name: 'Bitcoin' },
  { coingeckoId: 'ethereum',       symbol: 'ETH',   name: 'Ethereum' },
  { coingeckoId: 'tether',         symbol: 'USDT',  name: 'Tether' },
  { coingeckoId: 'binancecoin',    symbol: 'BNB',   name: 'BNB' },
  { coingeckoId: 'solana',         symbol: 'SOL',   name: 'Solana' },
  { coingeckoId: 'usd-coin',       symbol: 'USDC',  name: 'USD Coin' },
  { coingeckoId: 'ripple',         symbol: 'XRP',   name: 'XRP' },
  { coingeckoId: 'dogecoin',       symbol: 'DOGE',  name: 'Dogecoin' },
  { coingeckoId: 'cardano',        symbol: 'ADA',   name: 'Cardano' },
  { coingeckoId: 'tron',           symbol: 'TRX',   name: 'TRON' },
  { coingeckoId: 'avalanche-2',    symbol: 'AVAX',  name: 'Avalanche' },
  { coingeckoId: 'chainlink',      symbol: 'LINK',  name: 'Chainlink' },
  { coingeckoId: 'polkadot',       symbol: 'DOT',   name: 'Polkadot' },
  { coingeckoId: 'the-open-network', symbol: 'TON', name: 'Toncoin' },
  { coingeckoId: 'shiba-inu',      symbol: 'SHIB',  name: 'Shiba Inu' },
  { coingeckoId: 'matic-network',  symbol: 'POL',   name: 'Polygon' },
  { coingeckoId: 'litecoin',       symbol: 'LTC',   name: 'Litecoin' },
  { coingeckoId: 'bitcoin-cash',   symbol: 'BCH',   name: 'Bitcoin Cash' },
  { coingeckoId: 'uniswap',        symbol: 'UNI',   name: 'Uniswap' },
  { coingeckoId: 'stellar',        symbol: 'XLM',   name: 'Stellar' },
  { coingeckoId: 'cosmos',         symbol: 'ATOM',  name: 'Cosmos' },
  { coingeckoId: 'monero',         symbol: 'XMR',   name: 'Monero' },
  { coingeckoId: 'ethereum-classic', symbol: 'ETC', name: 'Ethereum Classic' },
  { coingeckoId: 'aptos',          symbol: 'APT',   name: 'Aptos' },
  { coingeckoId: 'near',           symbol: 'NEAR',  name: 'NEAR Protocol' },
  { coingeckoId: 'filecoin',       symbol: 'FIL',   name: 'Filecoin' },
  { coingeckoId: 'arbitrum',       symbol: 'ARB',   name: 'Arbitrum' },
  { coingeckoId: 'optimism',       symbol: 'OP',    name: 'Optimism' },
  { coingeckoId: 'internet-computer', symbol: 'ICP', name: 'Internet Computer' },
  { coingeckoId: 'hedera-hashgraph', symbol: 'HBAR', name: 'Hedera' },
  { coingeckoId: 'vechain',        symbol: 'VET',   name: 'VeChain' },
];

export function getCryptoCoin(id: string): CryptoCoin | undefined {
  return CRYPTO_COINS.find((c) => c.coingeckoId === id);
}

// CoinGecko tek çağrı URL'si (tüm coinler virgülle)
export function coingeckoPriceUrl(): string {
  const ids = CRYPTO_COINS.map((c) => c.coingeckoId).join(',');
  return `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
}
