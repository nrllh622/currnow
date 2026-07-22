// portfolioStore.ts
// MyNestVault — Portföy deposu: kullanıcının varlıkları
//
// Kurallar:
//  - Varlıklar %100 cihazda saklanır (AsyncStorage). Sunucuya HİÇBİR veri gitmez.
//  - Ekleme/silme/güncelleme anında diske yazılır.
//  - Ekranlar usePortfolio() hook'u ile okur ve değiştirir.

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@mynestvault/portfolio_v1';

// ---------------------------------------------------------------------------
// Varlık modeli
// ---------------------------------------------------------------------------
// Tek esnek kayıt tipi: her değerleme sınıfı kendi alanlarını kullanır,
// diğer alanlar boş kalır.
//
//  FX (cash, lent) : currencyCode + amount   (lent için ek: personName)
//  METAL (gold)    : pieceId + count  VEYA  weightGrams + purity
//  METAL (diğer)   : weightGrams (+ purity, varsayılan 1.0)
//  CRYPTO          : units
//  MANUAL          : manualValue + manualCurrency
//  Ortak opsiyonel : label, note, purchaseValue + purchaseCurrency (kâr/zarar)

export interface Asset {
  id: string;
  typeId: string;      // assetTypes.ts içindeki ASSET_TYPES id'si
  createdAt: number;   // epoch ms
  label?: string;      // kullanıcının verdiği isim ("Düğün altınları" vb.)
  note?: string;

  // FX
  currencyCode?: string;
  amount?: number;
  personName?: string; // alacaklar: kime verildi

  // METAL
  pieceId?: string;    // altın kalıbı (assetTypes.GOLD_PIECES id)
  count?: number;      // kalıp adedi
  weightGrams?: number;
  purity?: number;     // milyem (0-1); boşsa 1.0 kabul edilir

  // CRYPTO
  units?: number;

  // MANUAL
  manualValue?: number;
  manualCurrency?: string;

  // Opsiyonel alış bilgisi (kâr/zarar için)
  purchaseValue?: number;
  purchaseCurrency?: string;
}

export interface PortfolioState {
  assets: Asset[];
  loading: boolean;
  addAsset: (asset: Omit<Asset, 'id' | 'createdAt'>) => void;
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  removeAsset: (id: string) => void;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function loadAssets(): Promise<Asset[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Asset[]) : [];
  } catch {
    return [];
  }
}

async function saveAssets(assets: Asset[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
  } catch {
    // yazılamazsa sessiz geç; bir sonraki değişiklikte tekrar denenir
  }
}

// ---------------------------------------------------------------------------
// usePortfolio() — ekranların kullanacağı hook
// (App.tsx'te BİR KEZ çağrılıp props/context ile ekranlara dağıtılmalı)
// ---------------------------------------------------------------------------

export function usePortfolio(): PortfolioState {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadAssets().then((loaded) => {
      if (mounted) {
        setAssets(loaded);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const addAsset = useCallback((asset: Omit<Asset, 'id' | 'createdAt'>) => {
    setAssets((prev) => {
      const next = [...prev, { ...asset, id: makeId(), createdAt: Date.now() }];
      saveAssets(next);
      return next;
    });
  }, []);

  const updateAsset = useCallback((id: string, patch: Partial<Asset>) => {
    setAssets((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, ...patch, id: a.id } : a));
      saveAssets(next);
      return next;
    });
  }, []);

  const removeAsset = useCallback((id: string) => {
    setAssets((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveAssets(next);
      return next;
    });
  }, []);

  return { assets, loading, addAsset, updateAsset, removeAsset };
}
