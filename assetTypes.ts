// assetTypes.ts
// MyNestVault — Varlık tipi kayıt defteri ve birim katsayıları
// Yeni bir varlık tipi eklemek = bu dosyaya bir kayıt eklemek. Kod değişikliği gerekmez.

// ---------------------------------------------------------------------------
// Değerleme sınıfları
// ---------------------------------------------------------------------------
// FX     : Fiyatı open.er-api.com kur tablosundan gelir (miktar × kur)
// METAL  : Fiyatı api.gold-api.com'dan gelir (ağırlık × birim fiyat × saflık)
// CRYPTO : Fiyatı api.gold-api.com'dan gelir (adet × coin fiyatı)
// MANUAL : Kullanıcı değeri kendisi girer (mücevher, koleksiyon, diğer)

export type ValuationClass = 'FX' | 'METAL' | 'CRYPTO' | 'MANUAL';

export type MetalSymbol = 'XAU' | 'XAG' | 'XPT' | 'XPD' | 'HG';
export type CryptoSymbol = 'BTC' | 'ETH';

export interface AssetTypeDef {
  id: string;
  valuationClass: ValuationClass;
  /** METAL/CRYPTO için gold-api.com sembolü; FX için para kodunu kullanıcı seçer */
  symbol?: MetalSymbol | CryptoSymbol;
  labelTR: string;
  labelEN: string;
  emoji: string;
}

// ---------------------------------------------------------------------------
// Varlık tipleri (v1)
// ---------------------------------------------------------------------------

export const ASSET_TYPES: AssetTypeDef[] = [
  { id: 'cash',      valuationClass: 'FX',                    labelTR: 'Nakit Döviz',       labelEN: 'Cash',      emoji: '💵' },
  { id: 'gold',      valuationClass: 'METAL',  symbol: 'XAU', labelTR: 'Altın',             labelEN: 'Gold',      emoji: '🥇' },
  { id: 'silver',    valuationClass: 'METAL',  symbol: 'XAG', labelTR: 'Gümüş',             labelEN: 'Silver',    emoji: '🥈' },
  { id: 'platinum',  valuationClass: 'METAL',  symbol: 'XPT', labelTR: 'Platin',            labelEN: 'Platinum',  emoji: '⚪' },
  { id: 'palladium', valuationClass: 'METAL',  symbol: 'XPD', labelTR: 'Paladyum',          labelEN: 'Palladium', emoji: '⚡' },
  { id: 'copper',    valuationClass: 'METAL',  symbol: 'HG',  labelTR: 'Bakır',             labelEN: 'Copper',    emoji: '🔶' },
  { id: 'btc',       valuationClass: 'CRYPTO', symbol: 'BTC', labelTR: 'Bitcoin',           labelEN: 'Bitcoin',   emoji: '₿' },
  { id: 'eth',       valuationClass: 'CRYPTO', symbol: 'ETH', labelTR: 'Ethereum',          labelEN: 'Ethereum',  emoji: 'Ξ' },
  { id: 'jewelry',   valuationClass: 'MANUAL',                labelTR: 'Ziynet & Mücevher', labelEN: 'Jewelry',   emoji: '💍' },
  // Alacaklar FX sınıfında: "Ahmet'e 500 USD" kaydının tutarı sabittir,
  // ama TL/seçili para birimi karşılığı kurla birlikte canlı güncellenir.
  { id: 'lent',      valuationClass: 'FX',                    labelTR: 'Alacaklar',         labelEN: 'Money Lent', emoji: '🤝' },
  { id: 'other',     valuationClass: 'MANUAL',                labelTR: 'Diğer',             labelEN: 'Other',     emoji: '📦' },
];

export function getAssetType(id: string): AssetTypeDef | undefined {
  return ASSET_TYPES.find((t) => t.id === id);
}

// ---------------------------------------------------------------------------
// Ağırlık ve birim katsayıları
// ---------------------------------------------------------------------------

export const TROY_OUNCE_GRAMS = 31.1034768; // 1 troy ons = 31.1035 g
export const POUND_KG = 0.45359237;         // 1 pound = 0.4536 kg (bakır HG fiyatı USD/lb gelir)

/** Ayar → saflık oranı (milyem) */
export const KARAT_PURITY: Record<string, number> = {
  '24k': 0.995, // TR piyasasında has altın 995 milyem kabul edilir
  '22k': 0.916,
  '21k': 0.875,
  '18k': 0.750,
  '14k': 0.585,
  '8k':  0.333,
};

/** Türk kültürel altın kalıpları
 *  değer = adet × grams × purity × (24 ayar gram fiyatı / 0.995)
 */
export interface GoldPiece {
  id: string;
  labelTR: string;
  labelEN: string;
  grams: number;   // toplam ağırlık (gram)
  purity: number;  // milyem
}

export const GOLD_PIECES: GoldPiece[] = [
  { id: 'gram24', labelTR: 'Gram Altın (24k)', labelEN: 'Gram Gold (24k)', grams: 1,       purity: 0.995 },
  { id: 'gram22', labelTR: 'Gram Altın (22k)', labelEN: 'Gram Gold (22k)', grams: 1,       purity: 0.916 },
  { id: 'ceyrek', labelTR: 'Çeyrek Altın',     labelEN: 'Quarter Gold',    grams: 1.754,   purity: 0.916 },
  { id: 'yarim',  labelTR: 'Yarım Altın',      labelEN: 'Half Gold',       grams: 3.508,   purity: 0.916 },
  { id: 'tam',    labelTR: 'Tam Altın',        labelEN: 'Full Gold',       grams: 7.016,   purity: 0.916 },
  { id: 'ata',    labelTR: 'Ata Lira',         labelEN: 'Ata Lira',        grams: 7.216,   purity: 0.916 },
  { id: 'ons',    labelTR: 'Ons',              labelEN: 'Ounce',           grams: 31.1035, purity: 0.995 },
  { id: 'tola',   labelTR: 'Tola',             labelEN: 'Tola',            grams: 11.6638, purity: 0.995 },
];

export function getGoldPiece(id: string): GoldPiece | undefined {
  return GOLD_PIECES.find((p) => p.id === id);
}
