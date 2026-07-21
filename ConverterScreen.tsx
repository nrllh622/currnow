// ConverterScreen.tsx
// MyNestVault — Döviz çevirici sekmesi
// Eski App.tsx'teki CurrNow ekranının birebir taşınmış hali. Tek fark:
// kendi fetch'i yok — fiyatları merkezi priceStore'dan (props) alır.
// Böylece çevirici ile portföy her zaman aynı kuru gösterir.

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Currency, CURATED, buildCurrencyList } from './currencies';
import type { PriceState } from './priceStore';

type Rates = Record<string, number>;

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

export default function ConverterScreen({ prices }: { prices: PriceState }) {
  const insets = useSafeAreaInsets();
  const { snapshot, refreshing, error, refresh } = prices;

  const rates: Rates | null = snapshot ? snapshot.fxRates : null;

  const [base, setBase] = useState('USD');
  const [quote, setQuote] = useState('EUR');
  const [amount, setAmount] = useState('100');
  const [search, setSearch] = useState('');

  // Full currency list: curated first, then every other API code with a
  // readable name + auto colour. Falls back to curated list before load.
  const allCurrencies: Currency[] = useMemo(() => {
    if (rates) return buildCurrencyList(Object.keys(rates));
    return CURATED;
  }, [rates]);

  const currencyByCode = useMemo(() => {
    const m: Record<string, Currency> = {};
    for (const c of allCurrencies) m[c.code] = c;
    return m;
  }, [allCurrencies]);

  const amountNum = useMemo(() => {
    const n = parseFloat(amount.replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }, [amount]);

  const lastUpdatedLabel = useMemo(() => {
    if (!snapshot) return '';
    return formatUpdatedAt(snapshot.updatedAt);
  }, [snapshot]);

  const baseCur = currencyByCode[base];
  const quoteCur = currencyByCode[quote];

  // cross-rate base -> quote
  const pairRate = useMemo(() => {
    if (rates && rates[base] && rates[quote]) {
      return rates[quote] / rates[base];
    }
    return 0;
  }, [rates, base, quote]);

  const convertedValue = amountNum * pairRate;

  const swap = useCallback(() => {
    setBase((prevBase) => {
      setQuote(prevBase);
      return quote;
    });
  }, [quote]);

  // Filtered list for the rates section (search by code or name).
  const filtered: Currency[] = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return allCurrencies;
    return allCurrencies.filter(
      (c) => c.code.includes(q) || c.name.toUpperCase().includes(q)
    );
  }, [allCurrencies, search]);

  const renderItem = useCallback(
    ({ item }: { item: Currency }) => {
      let perUnit = 0;
      if (rates && rates[base] && rates[item.code]) {
        perUnit = rates[item.code] / rates[base];
      }
      const isActive = item.code === base || item.code === quote;
      return (
        <Pressable
          onPress={() => setQuote(item.code)}
          style={({ pressed }) => [
            styles.rateRow,
            isActive && styles.rateRowActive,
            pressed && styles.rowPressed,
          ]}
        >
          <View style={[styles.badge, { backgroundColor: item.color }]}>
            <Text style={styles.badgeText}>{item.symbol}</Text>
          </View>
          <View style={styles.rateText}>
            <Text style={styles.rateCode}>{item.code}</Text>
            <Text style={styles.rateName} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <Text style={styles.rateValue}>{formatNumber(perUnit)}</Text>
        </Pressable>
      );
    },
    [rates, base, quote]
  );

  if (!rates) {
    return (
      <View style={styles.loadingScreen}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              Could not load rates. Check your connection and try again.
            </Text>
            <Pressable onPress={refresh} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ActivityIndicator size="large" color="#16A382" />
            <Text style={styles.loadingText}>Loading rates…</Text>
          </>
        )}
      </View>
    );
  }

  const ListHeader = (
    <View>
      {/* Converter card block */}
      <View style={styles.converterWrap}>
        {/* Amount (from) */}
        <View style={styles.amountCard}>
          <Text style={styles.cardLabel}>Amount</Text>
          <View style={styles.cardRow}>
            <View style={[styles.badge, { backgroundColor: baseCur ? baseCur.color : '#22786E' }]}>
              <Text style={styles.badgeText}>{baseCur ? baseCur.symbol : '$'}</Text>
            </View>
            <Text style={styles.cardCode}>{base}</Text>
            <TextInput
              style={styles.amountInput}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              maxLength={12}
              selectTextOnFocus
            />
          </View>
        </View>

        {/* Swap button */}
        <View style={styles.swapWrap}>
          <Pressable
            onPress={swap}
            style={({ pressed }) => [styles.swapBtn, pressed && styles.rowPressed]}
          >
            <Text style={styles.swapArrows}>⇵</Text>
          </Pressable>
        </View>

        {/* Converted (to) */}
        <View style={[styles.amountCard, styles.convertedCard]}>
          <Text style={[styles.cardLabel, styles.convertedLabel]}>Converted to</Text>
          <View style={styles.cardRow}>
            <View style={[styles.badge, { backgroundColor: quoteCur ? quoteCur.color : '#2A5A96' }]}>
              <Text style={styles.badgeText}>{quoteCur ? quoteCur.symbol : '€'}</Text>
            </View>
            <Text style={styles.cardCode}>{quote}</Text>
            <Text style={styles.convertedValue}>{formatNumber(convertedValue)}</Text>
          </View>
        </View>

        {/* Rate line */}
        <Text style={styles.rateLine}>
          1 {base} = {formatNumber(pairRate)} {quote}
        </Text>
        {lastUpdatedLabel ? (
          <Text style={styles.updatedLine}>Last updated: {lastUpdatedLabel}</Text>
        ) : null}
      </View>

      {/* Rates list header + search */}
      <View style={styles.ratesHeaderRow}>
        <Text style={styles.ratesTitle}>Exchange Rates</Text>
        <Text style={styles.ratesBase}>Base: {base}</Text>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search currency (e.g. EUR, Yen)"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch('')} hitSlop={10}>
            <Text style={styles.clearIcon}>✕</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const ListEmpty = (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyText}>No currency matches “{search}”.</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Gradient header */}
      <LinearGradient
        colors={['#0F5856', '#168E78']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <Text style={styles.headerTitle}>Converter</Text>
        <View style={styles.headerAccent} />
      </LinearGradient>

      <FlatList
        style={styles.listFlex}
        data={filtered}
        keyExtractor={(item) => item.code}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={16}
        maxToRenderPerBatch={16}
        windowSize={10}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#16A382" />
        }
      />
    </View>
  );
}

const TEAL = '#16A382';
const INK = '#122E30';
const GREY = '#78888A';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F8F7' },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F5856',
    gap: 14,
  },
  loadingText: { fontSize: 15, color: '#CFEDE5' },

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

  listFlex: { flex: 1 },
  list: { paddingBottom: 24 },

  // Converter
  converterWrap: { paddingHorizontal: 16, paddingTop: 18 },
  amountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#E8EEED',
  },
  convertedCard: {
    backgroundColor: '#EFFAF6',
    borderColor: '#BEE8DA',
  },
  cardLabel: { fontSize: 14, color: GREY, fontWeight: '500', marginBottom: 12 },
  convertedLabel: { color: '#46967D' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardCode: { fontSize: 20, fontWeight: '700', color: INK },
  amountInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 26,
    fontWeight: '800',
    color: INK,
    padding: 0,
  },
  convertedValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 26,
    fontWeight: '800',
    color: TEAL,
  },

  // Swap
  swapWrap: { alignItems: 'center', marginVertical: -14, zIndex: 2 },
  swapBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6CDEBC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#F4F8F7',
  },
  swapArrows: { fontSize: 26, fontWeight: '800', color: '#0C3C37', marginTop: -2 },

  rateLine: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: INK,
    marginTop: 18,
  },
  updatedLine: { textAlign: 'center', fontSize: 12, color: GREY, marginTop: 4 },

  // Rates section
  ratesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 10,
  },
  ratesTitle: { fontSize: 18, fontWeight: '700', color: INK },
  ratesBase: { fontSize: 13, color: '#46967D', fontWeight: '600' },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EEED',
    gap: 10,
  },
  searchIcon: { fontSize: 22, color: GREY, marginTop: -2 },
  searchInput: { flex: 1, fontSize: 15, color: INK, padding: 0 },
  clearIcon: { fontSize: 15, color: GREY, fontWeight: '700' },

  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#ECF1F0',
  },
  rateRowActive: { borderColor: '#9BDEC8', backgroundColor: '#F5FCF9' },
  rowPressed: { opacity: 0.6 },

  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  rateText: { flex: 1 },
  rateCode: { fontSize: 17, fontWeight: '700', color: INK },
  rateName: { fontSize: 12, color: GREY, marginTop: 1 },
  rateValue: {
    fontSize: 19,
    fontWeight: '800',
    color: INK,
    fontVariant: ['tabular-nums'],
  },

  // Error
  errorBox: {
    marginHorizontal: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    gap: 10,
  },
  errorText: { color: '#B91C1C', textAlign: 'center', fontSize: 14 },
  retryBtn: {
    backgroundColor: TEAL,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryText: { color: '#FFFFFF', fontWeight: '700' },

  // Empty search
  emptyBox: { padding: 30, alignItems: 'center' },
  emptyText: { color: GREY, fontSize: 14 },
});
