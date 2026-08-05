// valuation.ts
// MyNestVault — Değerleme motoru
//
// Saf hesap katmanı: fiyat çekmez, durum tutmaz, ekran bilmez.
// Girdi: varlık listesi + fiyat anlık görüntüsü (priceStore.PriceSnapshot)
// Çıktı: seçilen gösterim para biriminde değerler.
//
// Birim kuralları:
//  - fxRates USD bazlıdır: rates['TRY'] = 41.2 → 1 USD = 41.2 TRY
//  - XAU/XAG/XPT/XPD fiyatı: USD / troy ons (31.1035 g saf metal)
//  - HG (bakır) fiyatı: USD / pound (0.4536 kg) → kg'a çevrilir
//  - BTC/ETH fiyatı: USD / adet

import type { Asset } from './portfolioStore';
import type { PriceSnapshot } from './priceStore';
import {
  getAssetType,
  getGoldPiece,
  POUND_KG,
  TROY_OUNCE_GRAMS,
  type MetalSymbol,
} from './assetTypes';

// ---------------------------------------------------------------------------
// Para birimi çevrimleri
// ---------------------------------------------------------------------------

/** Verilen para birimindeki tutarı USD'ye çevirir. Kur yoksa null. */
export function toUSD(
  amount: number,
  currencyCode: string,
  snapshot: PriceSnapshot
): number | null {
  if (currencyCode === 'USD') return amount;
  const rate = snapshot.fxRates[currencyCode];
  if (!rate || rate <= 0) return null;
  return amount / rate;
}

/** USD tutarını gösterim para birimine çevirir. Kur yoksa null. */
export function fromUSD(
  usdAmount: number,
  displayCurrency: string,
  snapshot: PriceSnapshot
): number | null {
  if (displayCurrency === 'USD') return usdAmount;
  const rate = snapshot.fxRates[displayCurrency];
  if (!rate || rate <= 0) return null;
  return usdAmount * rate;
}

// ---------------------------------------------------------------------------
// Metal yardımcıları
// ---------------------------------------------------------------------------

/** 1 gram SAF metalin USD fiyatı (XAU/XAG/XPT/XPD için). */
export function usdPerFineGram(
  symbol: Exclude<MetalSymbol, 'HG'>,
  snapshot: PriceSnapshot
): number | null {
  const perOunce = snapshot.usdPrices[symbol];
  if (!perOunce || perOunce <= 0) return null;
  return perOunce / TROY_OUNCE_GRAMS;
}

/** 1 kg bakırın USD fiyatı (HG fiyatı USD/pound gelir). */
export function usdPerCopperKg(snapshot: PriceSnapshot): number | null {
  const perPound = snapshot.usdPrices.HG;
  if (!perPound || perPound <= 0) return null;
  return perPound / POUND_KG;
}

// ---------------------------------------------------------------------------
// Tek varlık değerlemesi
// ---------------------------------------------------------------------------

/** Bir varlığın USD değeri. Fiyat/veri eksikse null (ekran "—" gösterir). */
export function valueAssetUSD(
  asset: Asset,
  snapshot: PriceSnapshot
): number | null {
  const type = getAssetType(asset.typeId);
  if (!type) return null;

  switch (type.valuationClass) {
    case 'FX': {
      if (!asset.currencyCode || !asset.amount) return null;
      return toUSD(asset.amount, asset.currencyCode, snapshot);
    }

    case 'METAL': {
      // Bakır: kg bazlı
      if (type.symbol === 'HG') {
        if (!asset.weightGrams) return null;
        const perKg = usdPerCopperKg(snapshot);
        if (perKg === null) return null;
        const purity = asset.purity ?? 1;
        return (asset.weightGrams / 1000) * purity * perKg;
      }

      const symbol = type.symbol as Exclude<MetalSymbol, 'HG'>;
      const perGram = usdPerFineGram(symbol, snapshot);
      if (perGram === null) return null;

      // Altın kalıbı (çeyrek/yarım/tam/ata/ons/tola) → adet × gram × saflık
      if (asset.pieceId && asset.count) {
        const piece = getGoldPiece(asset.pieceId);
        if (!piece) return null;
        return asset.count * piece.grams * piece.purity * perGram;
      }

      // Serbest ağırlık → gram × saflık
      if (asset.weightGrams) {
        const purity = asset.purity ?? 1;
        return asset.weightGrams * purity * perGram;
      }

      return null;
    }

    case 'CRYPTO': {
      if (!type.symbol || !asset.units) return null;
      const price = snapshot.usdPrices[type.symbol];
      if (!price || price <= 0) return null;
      return asset.units * price;
    }

    case 'MANUAL': {
      if (!asset.manualValue || !asset.manualCurrency) return null;
      return toUSD(asset.manualValue, asset.manualCurrency, snapshot);
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Portföy toplamları
// ---------------------------------------------------------------------------

export interface AssetValuation {
  asset: Asset;
  valueUSD: number | null;
  valueDisplay: number | null; // gösterim para biriminde
  /** Alış bilgisi girildiyse kâr/zarar (gösterim para biriminde), yoksa null */
  gainDisplay: number | null;
}

export interface PortfolioValuation {
  items: AssetValuation[];
  totalDisplay: number;        // değerlenebilen varlıkların toplamı
  totalGainDisplay: number | null; // alış bilgisi olanların toplam kâr/zararı
  /** Değerlenemeyen (fiyatı/verisi eksik) varlık sayısı */
  unpricedCount: number;
  /** Varlık tipi bazında alt toplamlar: { gold: 1234.5, cash: 678.9, ... } */
  totalsByType: Record<string, number>;
}

export function valuePortfolio(
  assets: Asset[],
  snapshot: PriceSnapshot,
  displayCurrency: string
): PortfolioValuation {
  const items: AssetValuation[] = [];
  const totalsByType: Record<string, number> = {};
  let totalDisplay = 0;
  let totalGainDisplay: number | null = null;
  let unpricedCount = 0;

  for (const asset of assets) {
    const valueUSD = valueAssetUSD(asset, snapshot);
    const valueDisplay =
      valueUSD !== null ? fromUSD(valueUSD, displayCurrency, snapshot) : null;

    let gainDisplay: number | null = null;
    if (
      valueUSD !== null &&
      valueDisplay !== null &&
      asset.purchaseValue &&
      asset.purchaseValue > 0
    ) {
      // Eski kayıtlarda purchaseCurrency eksik olabilir → USD varsay
      const purchaseCurrency = asset.purchaseCurrency ?? 'USD';
      const purchaseUSD = toUSD(asset.purchaseValue, purchaseCurrency, snapshot);
      if (purchaseUSD !== null) {
        const purchaseDisplay = fromUSD(purchaseUSD, displayCurrency, snapshot);
        if (purchaseDisplay !== null) {
          gainDisplay = valueDisplay - purchaseDisplay;
          totalGainDisplay = (totalGainDisplay ?? 0) + gainDisplay;
        }
      }
    }

    if (valueDisplay !== null) {
      totalDisplay += valueDisplay;
      totalsByType[asset.typeId] = (totalsByType[asset.typeId] ?? 0) + valueDisplay;
    } else {
      unpricedCount += 1;
    }

    items.push({ asset, valueUSD, valueDisplay, gainDisplay });
  }

  return { items, totalDisplay, totalGainDisplay, unpricedCount, totalsByType };
}
