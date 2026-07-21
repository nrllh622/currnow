// PortfolioScreen.tsx
// MyNestVault — Portföy ana ekranı
// Toplam değer kartı + varlık tipi kartları + boş durum.
// Varlık ekleme akışı bir sonraki adımda bağlanacak.

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ASSET_TYPES } from './assetTypes';
import type { PriceState } from './priceStore';
import type { PortfolioState } from './portfolioStore';
import { valuePortfolio } from './valuation';

// Toplam kartındaki para birimi — dokununca sıradakine geçer
const DISPLAY_CURRENCIES = ['USD', 'EUR', 'TRY'];

// Thousands separators without relying on Intl (Hermes-safe on Android).
function formatNumber(value: number): string {
  if (!isFinite(value)) return '—';
  const decimals = value !== 0 && Math.abs(value) < 1 ? 4 : 2;
  const fixed = value.toFixed(decimals);
  const parts = fixed.split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? intPart + '.' + parts[1] : intPart;
}

function formatUpdatedAt(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

interface Props {
  prices: PriceState;
  portfolio: PortfolioState;
}

export default function PortfolioScreen({ prices, portfolio }: Props) {
  const insets = useSafeAreaInsets();
  const { snapshot } = prices;
  const { assets } = portfolio;

  const [displayIdx, setDisplayIdx] = useState(0);
  const displayCurrency = DISPLAY_CURRENCIES[displayIdx];

  const cycleCurrency = () =>
    setDisplayIdx((i) => (i + 1) % DISPLAY_CURRENCIES.length);

  const valuation = useMemo(() => {
    if (!snapshot) return null;
    return valuePortfolio(assets, snapshot, displayCurrency);
  }, [snapshot, assets, displayCurrency]);

  // Tip bazında varlık adedi
  const countsByType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of assets) m[a.typeId] = (m[a.typeId] ?? 0) + 1;
    return m;
  }, [assets]);

  const onAddPress = () => {
    Alert.alert('Add Asset', 'Asset entry is coming in the next step.');
  };

  const hasAssets = assets.length > 0;

  return (
    <View style={styles.root}>
      {/* Gradient header */}
      <LinearGradient
        colors={['#0F5856', '#168E78']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <Text style={styles.headerTitle}>MyNestVault</Text>
        <View style={styles.headerAccent} />
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Toplam değer kartı */}
        <View style={styles.totalCard}>
          <View style={styles.totalTopRow}>
            <Text style={styles.totalLabel}>Total Value</Text>
            <Pressable onPress={cycleCurrency} style={styles.currencyChip} hitSlop={8}>
              <Text style={styles.currencyChipText}>{displayCurrency} ▾</Text>
            </Pressable>
          </View>

          {!snapshot ? (
            <View style={styles.totalLoading}>
              <ActivityIndicator size="small" color="#16A382" />
            </View>
          ) : (
            <Text style={styles.totalValue}>
              {formatNumber(valuation ? valuation.totalDisplay : 0)}{' '}
              <Text style={styles.totalCurrency}>{displayCurrency}</Text>
            </Text>
          )}

          {snapshot ? (
            <Text style={styles.updatedLine}>
              Updated {formatUpdatedAt(snapshot.updatedAt)}
              {valuation && valuation.unpricedCount > 0
                ? ` · ${valuation.unpricedCount} item(s) not priced yet`
                : ''}
            </Text>
          ) : null}
        </View>

        {/* Varlık tipi kartları / boş durum */}
        {hasAssets ? (
          <View style={styles.typeGrid}>
            {ASSET_TYPES.filter((t) => (countsByType[t.id] ?? 0) > 0).map((t) => {
              const total = valuation ? valuation.totalsByType[t.id] ?? 0 : 0;
              const count = countsByType[t.id] ?? 0;
              return (
                <View key={t.id} style={styles.typeCard}>
                  <Text style={styles.typeEmoji}>{t.emoji}</Text>
                  <Text style={styles.typeLabel}>{t.labelEN}</Text>
                  <Text style={styles.typeCount}>
                    {count} item{count > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.typeValue}>
                    {formatNumber(total)} {displayCurrency}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🪺</Text>
            <Text style={styles.emptyTitle}>Your vault is empty</Text>
            <Text style={styles.emptyText}>
              Add your cash, gold, silver, crypto and other valuables to see
              their live total value — all stored only on this device.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Varlık ekle butonu */}
      <Pressable
        onPress={onAddPress}
        style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
      >
        <Text style={styles.addBtnText}>＋ Add Asset</Text>
      </Pressable>
    </View>
  );
}

const TEAL = '#16A382';
const INK = '#122E30';
const GREY = '#78888A';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F8F7' },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingBottom: 22,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  headerTitle: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  headerAccent: {
    marginTop: 10,
    width: 64,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#6CDEBC',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 90 },

  // Toplam kart
  totalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    marginHorizontal: 16,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#E8EEED',
  },
  totalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: { fontSize: 14, color: GREY, fontWeight: '500' },
  currencyChip: {
    backgroundColor: '#EFFAF6',
    borderWidth: 1,
    borderColor: '#BEE8DA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  currencyChipText: { fontSize: 13, fontWeight: '700', color: '#0F5856' },
  totalLoading: { paddingVertical: 16, alignItems: 'flex-start' },
  totalValue: {
    fontSize: 34,
    fontWeight: '800',
    color: INK,
    marginTop: 10,
    fontVariant: ['tabular-nums'],
  },
  totalCurrency: { fontSize: 18, fontWeight: '700', color: GREY },
  updatedLine: { fontSize: 12, color: GREY, marginTop: 6 },

  // Tip kartları
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    marginTop: 14,
  },
  typeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECF1F0',
    width: '46%',
    marginHorizontal: '2%',
    marginBottom: 12,
    padding: 16,
  },
  typeEmoji: { fontSize: 26 },
  typeLabel: { fontSize: 15, fontWeight: '700', color: INK, marginTop: 8 },
  typeCount: { fontSize: 12, color: GREY, marginTop: 1 },
  typeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: TEAL,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },

  // Boş durum
  emptyBox: {
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingTop: 46,
  },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: INK, marginTop: 14 },
  emptyText: {
    fontSize: 14,
    color: GREY,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },

  // Ekle butonu
  addBtn: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 16,
    backgroundColor: TEAL,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    elevation: 4,
  },
  addBtnPressed: { opacity: 0.85 },
  addBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
