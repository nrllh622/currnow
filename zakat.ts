// zakat.ts
// MyNestVault — Zekat/nisab hesabı (v1.1, yalnızca Türkçe arayüzde gösterilir)
//
// Kurallar (Türkiye — Diyanet İşleri Başkanlığı / TDV ölçüsü):
//   - Nisab = 80,18 gram saf altın değeri (Diyanet'in kabul ettiği ölçü;
//     bazı klasik kaynaklarda 85 gram geçer, Diyanet 80,18 gramı esas alır)
//   - Zekata tabi varlıkların toplamı nisabı aşıyorsa zekat gerekir
//   - Zekat oranı = %2,5 (kırkta bir)
//
// ÖNEMLİ: Bu bir tahmindir, dini bağlayıcılığı yoktur. Uygulama kullanıcıyı
// resmi kaynağa (Diyanet) yönlendirir. Ziynet/mücevher ve "diğer" gibi
// kişisel eşyalar dışarıda bırakılır (bunlar tartışmalıdır, kullanıcı kendi
// takdir etmeli).

import type { Asset } from './portfolioStore';
import type { PriceSnapshot } from './priceStore';
import { valueAssetUSD, fromUSD } from './valuation';
import { getAssetType } from './assetTypes';

// Diyanet nisab ölçüsü: 80,18 gram saf (24 ayar) altın
export const NISAB_GOLD_GRAMS = 80.18;
export const ZAKAT_RATE = 0.025; // %2,5

// Zekata tabi varlık tipleri: nakit, altın, gümüş, platin, paladyum, bakır,
// kripto (BTC/ETH/diğer), alacaklar. Hariç: ziynet & mücevher (kullanım
// takısı), "diğer" (araba/arsa gibi zekata tabi olmayabilir).
const ZAKATABLE_TYPES = new Set([
  'cash',
  'gold',
  'silver',
  'platinum',
  'palladium',
  'copper',
  'btc',
  'eth',
  'crypto',
  'lent',
]);

export interface ZakatResult {
  /** Zekata tabi varlıkların seçili para birimindeki toplamı */
  zakatableTotal: number;
  /** Nisab eşiği (80,18 g altının seçili para birimindeki değeri) */
  nisabValue: number;
  /** Toplam nisabı aşıyor mu? */
  meetsNisab: boolean;
  /** Ödenmesi gereken zekat (nisab aşılıyorsa total × %2,5; yoksa 0) */
  zakatDue: number;
  /** Fiyat verisi eksikse hesap yapılamaz */
  available: boolean;
}

/**
 * Portföyün zekatını hesaplar.
 * Nisab = 80,18 gram 24 ayar altının güncel değeri.
 * Altın gram fiyatını snapshot'tan türetir (XAU: USD/troy ons).
 */
export function computeZakat(
  assets: Asset[],
  snapshot: PriceSnapshot | null,
  displayCurrency: string
): ZakatResult {
  const empty: ZakatResult = {
    zakatableTotal: 0,
    nisabValue: 0,
    meetsNisab: false,
    zakatDue: 0,
    available: false,
  };
  if (!snapshot) return empty;

  // Nisab için 24 ayar (saf) altının gram fiyatı gerekli.
  // XAU snapshot'ta USD/troy ons; gram fiyatı = perOunce / 31.1035.
  const perOunceUSD = snapshot.usdPrices.XAU;
  if (!perOunceUSD || perOunceUSD <= 0) return empty;

  const TROY_OUNCE_GRAMS = 31.1034768;
  const pureGramUSD = perOunceUSD / TROY_OUNCE_GRAMS; // saf altın USD/gram
  const nisabUSD = pureGramUSD * NISAB_GOLD_GRAMS;

  // Zekata tabi varlıkların toplamı (önce USD'de topla)
  let zakatableUSD = 0;
  for (const asset of assets) {
    const type = getAssetType(asset.typeId);
    if (!type || !ZAKATABLE_TYPES.has(asset.typeId)) continue;
    const v = valueAssetUSD(asset, snapshot);
    if (v !== null && v > 0) zakatableUSD += v;
  }

  // USD → seçili para birimi (tek çevrim)
  const nisabValue = fromUSD(nisabUSD, displayCurrency, snapshot);
  const zakatableTotal = fromUSD(zakatableUSD, displayCurrency, snapshot);
  if (nisabValue === null || zakatableTotal === null) return empty;

  const meetsNisab = zakatableTotal >= nisabValue;
  const zakatDue = meetsNisab ? zakatableTotal * ZAKAT_RATE : 0;

  return {
    zakatableTotal,
    nisabValue,
    meetsNisab,
    zakatDue,
    available: true,
  };
}
