import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import mobileAds, {
  AdsConsent,
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';
import {
  Currency,
  CURATED,
  buildCurrencyList,
} from './currencies';

const API_URL = 'https://open.er-api.com/v6/latest/USD';

// --- AdMob ---------------------------------------------------------------
// Closed testing boyunca TEST reklamı gösteriyoruz. Kendi CANLI reklamına
// tıklamak AdMob hesabını KALICI olarak bloklayabilir. Uygulama Play'de tam
// yayına geçip gerçek gelir istediğinde, sadece şu satırı false yap:
const USE_TEST_ADS = false;

const REAL_BANNER_UNIT_ID = 'ca-app-pub-2984878117732696/7056959989';
const BANNER_UNIT_ID = USE_TEST_ADS ? TestIds.BANNER : REAL_BANNER_UNIT_ID;
// ------------------------------------------------------------------------

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

export default function App() {
  return (
    <SafeAreaProvider>
      <CurrNow />
    </SafeAreaProvider>
  );
}

function CurrNow() {
  const insets = useSafeAreaInsets();

  const [rates, setRates] = useState<Rates | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adsReady, setAdsReady] = useState(false);

  const [base, setBase] = useState('USD');
  const [quote, setQuote] = useState('EUR');
  const [amount, setAmount] = useState('100');
  const [search, setSearch] = useState('');

  // Initialise AdMob once: gather UMP/GDPR consent, then start the SDK.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await AdsConsent.gatherConsent();
      } catch (e) {
        // Consent could not be gathered (e.g. offline). Continue anyway.
      }
      try {
        await mobileAds().initialize();
      } catch (e) {
        // Initialise failed; banner simply won't show.
      }
      if (mounted) setAdsReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const loadRates = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(API_URL);
      const json = await res.json();
      if (json.result !== 'success' || !json.rates) {
        throw new Error('bad response');
      }
      setRates(json.rates as Rates);
      setUpdatedAt(typeof json.time_last_update_utc === 'string' ? json.time_last_update_utc : '');
    } catch (e) {
      setError('Could not load rates. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRates();
  }, [loadRates]);

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
    if (!updatedAt) return '';
    return updatedAt.replace(/^[A-Za-z]{3},\s*/, '').replace(/\s*\+0000$/, ' UTC');
  }, [updatedAt]);

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

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#16A382" />
        <Text style={styles.loadingText}>Loading rates…</Text>
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

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={onRefresh} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

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
      <StatusBar style="light" />

      {/* Gradient header */}
      <LinearGradient
        colors={['#0F5856', '#168E78']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <Text style={styles.headerTitle}>CurrNow</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16A382" />
        }
      />

      {adsReady ? (
        <View style={[styles.banner, { paddingBottom: insets.bottom }]}>
          <BannerAd unitId={BANNER_UNIT_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
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
    marginTop: 14,
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

  // Banner
  banner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8EEED',
  },
});
