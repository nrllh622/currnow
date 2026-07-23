// PortfolioScreen.tsx
// MyNestVault — Portföy ana ekranı
// Toplam değer kartı + varlık tipi kartları + boş durum.
// Varlık ekleme akışı bir sonraki adımda bağlanacak.

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ASSET_TYPES } from './assetTypes';
import { Currency, CURATED, buildCurrencyList } from './currencies';
import type { PriceState } from './priceStore';
import type { PortfolioState } from './portfolioStore';
import { valuePortfolio } from './valuation';
import AddAssetScreen from './AddAssetScreen';
import AssetListScreen from './AssetListScreen';
import { useT, pickLabel } from './i18n';

// Seçilen gösterim para birimi cihazda saklanır
const DISPLAY_KEY = '@mynestvault/display_currency';

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
  const { t, lang } = useT();
  const { snapshot } = prices;
  const { assets } = portfolio;

  const [adding, setAdding] = useState(false);
  const [viewingType, setViewingType] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [pickingCurrency, setPickingCurrency] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');

  // Kayıtlı gösterim para birimini yükle
  useEffect(() => {
    AsyncStorage.getItem(DISPLAY_KEY)
      .then((saved) => {
        if (saved) setDisplayCurrency(saved);
      })
      .catch(() => {});
  }, []);

  const selectDisplayCurrency = (code: string) => {
    setDisplayCurrency(code);
    setPickingCurrency(false);
    setCurrencySearch('');
    AsyncStorage.setItem(DISPLAY_KEY, code).catch(() => {});
  };

  // Tam para birimi listesi (çeviricidekiyle aynı kaynak)
  const allCurrencies: Currency[] = useMemo(() => {
    if (snapshot) return buildCurrencyList(Object.keys(snapshot.fxRates));
    return CURATED;
  }, [snapshot]);

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.trim().toUpperCase();
    if (!q) return allCurrencies;
    return allCurrencies.filter(
      (c) => c.code.includes(q) || c.name.toUpperCase().includes(q)
    );
  }, [allCurrencies, currencySearch]);

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

  // "Other" varlıkları gruplanmaz — her biri kendi adıyla ayrı kart olur
  const otherItems = useMemo(() => {
    if (!valuation) return [];
    return valuation.items.filter((i) => i.asset.typeId === 'other');
  }, [valuation]);

  // Tip bazında toplam kâr/zarar (alış bilgisi girilen varlıklardan)
  const gainsByType = useMemo(() => {
    const m: Record<string, number> = {};
    if (!valuation) return m;
    for (const item of valuation.items) {
      if (item.gainDisplay !== null) {
        m[item.asset.typeId] = (m[item.asset.typeId] ?? 0) + item.gainDisplay;
      }
    }
    return m;
  }, [valuation]);

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
            <Text style={styles.totalLabel}>{t('portfolio.total')}</Text>
            <Pressable
              onPress={() => setPickingCurrency(true)}
              style={styles.currencyChip}
              hitSlop={8}
            >
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
              {t('portfolio.updated', { time: formatUpdatedAt(snapshot.updatedAt) })}
              {valuation && valuation.unpricedCount > 0
                ? ` · ${t('portfolio.notPriced', { n: valuation.unpricedCount })}`
                : ''}
            </Text>
          ) : null}
        </View>

        {/* Varlık tipi kartları / boş durum */}
        {hasAssets ? (
          <View style={styles.typeGrid}>
            {/* Gruplu tip kartları (Other hariç) */}
            {ASSET_TYPES.filter(
              (x) => x.id !== 'other' && (countsByType[x.id] ?? 0) > 0
            ).map((t2) => {
              const total = valuation ? valuation.totalsByType[t2.id] ?? 0 : 0;
              const count = countsByType[t2.id] ?? 0;
              const gain = t2.id in gainsByType ? gainsByType[t2.id] : null;
              return (
                <Pressable
                  key={t2.id}
                  onPress={() => setViewingType(t2.id)}
                  style={({ pressed }) => [styles.typeCard, pressed && styles.addBtnPressed]}
                >
                  <Text style={styles.typeEmoji}>{t2.emoji}</Text>
                  <Text style={styles.typeLabel}>{pickLabel(t2, lang)}</Text>
                  <Text style={styles.typeCount}>
                    {t(count === 1 ? 'common.item_one' : 'common.item_other', {
                      n: count,
                    })}
                  </Text>
                  <Text style={styles.typeValue}>
                    {formatNumber(total)} {displayCurrency}
                  </Text>
                  {gain !== null ? (
                    <Text
                      style={[styles.typeGain, gain >= 0 ? styles.gainUp : styles.gainDown]}
                    >
                      {gain >= 0 ? '▲' : '▼'} {formatNumber(Math.abs(gain))}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}

            {/* "Other" varlıkları: her biri kendi adıyla ayrı kart */}
            {otherItems.map((item) => (
              <Pressable
                key={item.asset.id}
                onPress={() => setViewingType('other')}
                style={({ pressed }) => [styles.typeCard, pressed && styles.addBtnPressed]}
              >
                <Text style={styles.typeEmoji}>📦</Text>
                <Text style={styles.typeLabel} numberOfLines={1}>
                  {item.asset.label ?? pickLabel({ labelEN: 'Other', labelTR: 'Diğer' }, lang)}
                </Text>
                <Text style={styles.typeCount}>
                  {pickLabel({ labelEN: 'Other', labelTR: 'Diğer' }, lang)}
                </Text>
                <Text style={styles.typeValue}>
                  {item.valueDisplay !== null
                    ? `${formatNumber(item.valueDisplay)} ${displayCurrency}`
                    : '—'}
                </Text>
                {item.gainDisplay !== null ? (
                  <Text
                    style={[
                      styles.typeGain,
                      item.gainDisplay >= 0 ? styles.gainUp : styles.gainDown,
                    ]}
                  >
                    {item.gainDisplay >= 0 ? '▲' : '▼'}{' '}
                    {formatNumber(Math.abs(item.gainDisplay))}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🪺</Text>
            <Text style={styles.emptyTitle}>{t('portfolio.emptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('portfolio.emptyDesc')}</Text>
          </View>
        )}
      </ScrollView>

      {/* Varlık ekle butonu */}
      <Pressable
        onPress={() => setAdding(true)}
        style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
      >
        <Text style={styles.addBtnText}>{t('portfolio.addAsset')}</Text>
      </Pressable>

      {/* Varlık ekleme akışı (tam ekran kaplama) */}
      <AddAssetScreen
        visible={adding}
        prices={prices}
        onClose={() => setAdding(false)}
        onSave={(asset) => {
          portfolio.addAsset(asset);
          setAdding(false);
        }}
      />

      {/* Varlık listesi (tip kartına dokununca) */}
      <AssetListScreen
        visible={viewingType !== null}
        title={
          viewingType === 'other'
            ? t('list.otherAssets')
            : (() => {
                const found = ASSET_TYPES.find((x) => x.id === viewingType);
                return found ? pickLabel(found, lang) : '';
              })()
        }
        items={
          valuation && viewingType
            ? valuation.items.filter((i) => i.asset.typeId === viewingType)
            : []
        }
        displayCurrency={displayCurrency}
        onDelete={(id) => {
          const remaining = viewingType ? (countsByType[viewingType] ?? 0) - 1 : 0;
          portfolio.removeAsset(id);
          if (remaining <= 0) setViewingType(null);
        }}
        onClose={() => setViewingType(null)}
      />

      {/* Gösterim para birimi seçici (tam ekran kaplama) */}
      {pickingCurrency ? (
        <View style={[styles.pickerOverlay, { paddingTop: insets.top }]}>
          <View style={styles.pickerTopBar}>
            <Pressable
              onPress={() => {
                setPickingCurrency(false);
                setCurrencySearch('');
              }}
              hitSlop={10}
            >
              <Text style={styles.pickerAction}>‹ {t('common.back')}</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>{t('portfolio.showTotalIn')}</Text>
            <View style={styles.pickerSpacer} />
          </View>
          <View style={styles.pickerSearchWrap}>
            <Text style={styles.pickerSearchIcon}>⌕</Text>
            <TextInput
              style={styles.pickerSearchInput}
              value={currencySearch}
              onChangeText={setCurrencySearch}
              placeholder={t('common.searchCurrency')}
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={filteredCurrencies}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item.code === displayCurrency;
              return (
                <Pressable
                  onPress={() => selectDisplayCurrency(item.code)}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    active && styles.pickerRowActive,
                    pressed && styles.addBtnPressed,
                  ]}
                >
                  <View style={[styles.pickerBadge, { backgroundColor: item.color }]}>
                    <Text style={styles.pickerBadgeText}>{item.symbol}</Text>
                  </View>
                  <View style={styles.pickerText}>
                    <Text style={styles.pickerCode}>{item.code}</Text>
                    <Text style={styles.pickerName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                  {active ? <Text style={styles.pickerCheck}>✓</Text> : null}
                </Pressable>
              );
            }}
          />
        </View>
      ) : null}
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
  // Varlık adı sıcak altın tonunda, değer koyu mürekkepte, kâr/zarar yeşil-kırmızı:
  // üç bilgi de birbirinden net ayrışır (ve altın teması ile uyumlu)
  typeLabel: { fontSize: 15, fontWeight: '800', color: '#B8860B', marginTop: 8 },
  typeCount: { fontSize: 12, color: GREY, marginTop: 1 },
  typeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: INK,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  typeGain: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  gainUp: { color: '#0E9F6E' },
  gainDown: { color: '#DC2626' },

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

  // Gösterim para birimi seçici
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F4F8F7',
    zIndex: 20,
  },
  pickerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerAction: { fontSize: 15, fontWeight: '700', color: TEAL },
  pickerTitle: { fontSize: 17, fontWeight: '800', color: INK },
  pickerSpacer: { width: 60 },
  pickerSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EEED',
    gap: 10,
  },
  pickerSearchIcon: { fontSize: 22, color: GREY, marginTop: -2 },
  pickerSearchInput: { flex: 1, fontSize: 15, color: INK, padding: 0 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#ECF1F0',
  },
  pickerRowActive: { borderColor: '#9BDEC8', backgroundColor: '#F5FCF9' },
  pickerBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerBadgeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  pickerText: { flex: 1 },
  pickerCode: { fontSize: 16, fontWeight: '700', color: INK },
  pickerName: { fontSize: 12, color: GREY, marginTop: 1 },
  pickerCheck: { fontSize: 18, fontWeight: '800', color: TEAL },
});
