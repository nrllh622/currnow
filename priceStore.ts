// priceStore.ts
// MyNestVault — Merkezi fiyat deposu
//
// Kurallar:
//  - Fiyatı YALNIZCA bu dosya çeker; tüm ekranlar usePrices() ile buradan okur.
//  - Tazeleme: 90 saniyede bir, SADECE uygulama ön plandayken (pil + maliyet).
//  - Uygulama öne dönünce veri 90 sn'den eskiyse anında bir kez tazelenir.
//  - Son fiyatlar AsyncStorage'da saklanır: açılışta önce önbellek gösterilir,
//    internet yoksa "son bilinen değerler" ile çalışılır.
//
// Kaynaklar (ikisi de anahtarsız — APK içine gömülü API anahtarı YOKTUR):
//  - open.er-api.com  → 160+ fiat kur (USD bazlı)   [mevcut motor]
//  - api.gold-api.com → XAU, XAG, XPT, XPD, HG, BTC, ETH (USD)

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CryptoSymbol, MetalSymbol } from './assetTypes';

export const PRICE_REFRESH_MS = 90_000; // 90 saniye (1-2 dk bandı)

const FX_API_URL = 'https://open.er-api.com/v6/latest/USD';
const GOLD_API_BASE = 'https://api.gold-api.com/price';
const STORAGE_KEY = '@mynestvault/price_snapshot_v1';

const GOLD_API_SYMBOLS: (MetalSymbol | CryptoSymbol)[] = [
  'XAU', 'XAG', 'XPT', 'XPD', 'HG', 'BTC', 'ETH',
];

export interface PriceSnapshot {
  /** USD bazlı kurlar: { TRY: 41.2, EUR: 0.92, ... } */
  fxRates: Record<string, number>;
  /** USD birim fiyatlar. Metaller: USD/troy ons (HG: USD/pound). Kripto: USD/adet */
  usdPrices: Partial<Record<MetalSymbol | CryptoSymbol, number>>;
  /** Son başarılı tazeleme (epoch ms) */
  updatedAt: number;
}

export interface PriceState {
  snapshot: PriceSnapshot | null;
  loading: boolean;    // ilk yükleme (önbellek de yoksa true kalır)
  refreshing: boolean; // elle tazeleme sürüyor
  error: string | null;
  refresh: () => void; // pull-to-refresh için
}

async function fetchFxRates(): Promise<Record<string, number>> {
  const res = await fetch(FX_API_URL);
  const json = await res.json();
  if (json.result !== 'success' || !json.rates) {
    throw new Error('FX: bad response');
  }
  return json.rates as Record<string, number>;
}

async function fetchGoldApiPrice(
  symbol: MetalSymbol | CryptoSymbol
): Promise<number | null> {
  try {
    const res = await fetch(`${GOLD_API_BASE}/${symbol}`);
    const json = await res.json();
    const price = typeof json.price === 'number' ? json.price : Number(json.price);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null; // tek bir sembolün düşmesi tüm tazelemeyi düşürmesin
  }
}

async function fetchAllPrices(): Promise<PriceSnapshot> {
  // İki kaynak paralel; metal/kripto sembolleri de kendi içinde paralel
  const [fxRates, goldResults] = await Promise.all([
    fetchFxRates(),
    Promise.all(GOLD_API_SYMBOLS.map((s) => fetchGoldApiPrice(s))),
  ]);

  const usdPrices: PriceSnapshot['usdPrices'] = {};
  GOLD_API_SYMBOLS.forEach((symbol, i) => {
    const p = goldResults[i];
    if (p !== null) usdPrices[symbol] = p;
  });

  return { fxRates, usdPrices, updatedAt: Date.now() };
}

async function loadCachedSnapshot(): Promise<PriceSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.fxRates && parsed.updatedAt) return parsed as PriceSnapshot;
    return null;
  } catch {
    return null;
  }
}

async function saveCachedSnapshot(snap: PriceSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    // önbellek yazılamazsa sessiz geç — kritik değil
  }
}

// ---------------------------------------------------------------------------
// usePrices() — tüm ekranların kullanacağı tek hook
// (App.tsx'te BİR KEZ çağrılıp props/context ile ekranlara dağıtılmalı)
// ---------------------------------------------------------------------------

export function usePrices(): PriceState {
  const [snapshot, setSnapshot] = useState<PriceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const snapshotRef = useRef<PriceSnapshot | null>(null);
  snapshotRef.current = snapshot;

  const doFetch = useCallback(async (isManual: boolean) => {
    if (isManual) setRefreshing(true);
    try {
      const snap = await fetchAllPrices();
      setSnapshot(snap);
      setError(null);
      saveCachedSnapshot(snap);
    } catch {
      // Taze veri alınamadı: elimizdeki (önbellek dahil) son değerle devam
      setError('offline');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => doFetch(false), PRICE_REFRESH_MS);
  }, [doFetch]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Açılış: önce önbellek, ardından taze veri, sonra zamanlayıcı
  useEffect(() => {
    let mounted = true;
    (async () => {
      const cached = await loadCachedSnapshot();
      if (mounted && cached) {
        setSnapshot(cached);
        setLoading(false);
      }
      await doFetch(false);
      if (mounted) startTimer();
    })();
    return () => {
      mounted = false;
      stopTimer();
    };
  }, [doFetch, startTimer, stopTimer]);

  // Ön plan / arka plan yönetimi
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        const last = snapshotRef.current?.updatedAt ?? 0;
        if (Date.now() - last > PRICE_REFRESH_MS) {
          doFetch(false); // eskimişse dönüşte hemen tazele
        }
        startTimer();
      } else {
        stopTimer(); // arka planda sıfır istek, sıfır pil
      }
    });
    return () => sub.remove();
  }, [doFetch, startTimer, stopTimer]);

  const refresh = useCallback(() => doFetch(true), [doFetch]);

  return { snapshot, loading, refreshing, error, refresh };
}
