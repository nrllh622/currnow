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
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import mobileAds, {
  AdsConsent,
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';

const API_URL = 'https://open.er-api.com/v6/latest/USD';

// --- AdMob ---------------------------------------------------------------
// Closed testing boyunca TEST reklamı gösteriyoruz. Kendi CANLI reklamına
// tıklamak AdMob hesabını KALICI olarak bloklayabilir. Uygulama Play'de tam
// yayına geçip gerçek gelir istediğinde, sadece şu satırı false yap:
const USE_TEST_ADS = true;

const REAL_BANNER_UNIT_ID = 'ca-app-pub-2984878117732696/7056959989';
const BANNER_UNIT_ID = USE_TEST_ADS ? TestIds.BANNER : REAL_BANNER_UNIT_ID;
// ------------------------------------------------------------------------

type Currency = { code: string; name: string; flag: string };

// Curated default list. USD-based rates are fetched once and cross-rates
// are computed locally, so changing the base never needs a new request.
const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
  { code: 'TRY', name: 'Turkish Lira', flag: '🇹🇷' },
  { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CNY', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal', flag: '🇸🇦' },
  { code: 'RUB', name: 'Russian Ruble', flag: '🇷🇺' },
  { code: 'INR', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'BRL', name: 'Brazilian Real', flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso', flag: '🇲🇽' },
  { code: 'ZAR', name: 'South African Rand', flag: '🇿🇦' },
  { code: 'SEK', name: 'Swedish Krona', flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone', flag: '🇳🇴' },
  { code: 'DKK', name: 'Danish Krone', flag: '🇩🇰' },
  { code: 'PLN', name: 'Polish Zloty', flag: '🇵🇱' },
  { code: 'KRW', name: 'South Korean Won', flag: '🇰🇷' },
  { code: 'SGD', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'HKD', name: 'Hong Kong Dollar', flag: '🇭🇰' },
  { code: 'NZD', name: 'New Zealand Dollar', flag: '🇳🇿' },
];

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
  const [amount, setAmount] = useState('1');

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
      setError('Kurlar alınamadı. İnternet bağlantını kontrol edip tekrar dene.');
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

  const amountNum = useMemo(() => {
    const n = parseFloat(amount.replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }, [amount]);

  const lastUpdatedLabel = useMemo(() => {
    if (!updatedAt) return '';
    return updatedAt.replace(/^[A-Za-z]{3},\s*/, '').replace(/\s*\+0000$/, ' UTC');
  }, [updatedAt]);

  const baseCurrency = useMemo(
    () => CURRENCIES.find((c) => c.code === base),
    [base]
  );

  const renderItem = useCallback(
    ({ item }: { item: Currency }) => {
      let converted = 0;
      if (rates && rates[base] && rates[item.code]) {
        converted = amountNum * (rates[item.code] / rates[base]);
      }
      const isBase = item.code === base;
      return (
        <Pressable
          onPress={() => setBase(item.code)}
          style={({ pressed }) => [
            styles.row,
            isBase && styles.rowActive,
            pressed && styles.rowPressed,
          ]}
        >
          <Text style={styles.flag}>{item.flag}</Text>
          <View style={styles.rowText}>
            <Text style={styles.code}>{item.code}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <Text style={[styles.value, isBase && styles.valueActive]}>
            {formatNumber(converted)}
          </Text>
        </Pressable>
      );
    },
    [rates, base, amountNum]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.muted}>Kurlar yükleniyor…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title}>CurrNow</Text>
        {lastUpdatedLabel ? (
          <Text style={styles.muted}>Son güncelleme: {lastUpdatedLabel}</Text>
        ) : null}
      </View>

      <View style={styles.inputCard}>
        <Text style={styles.baseFlag}>{baseCurrency ? baseCurrency.flag : '💱'}</Text>
        <View style={styles.inputTextWrap}>
          <Text style={styles.baseCode}>{base}</Text>
          <Text style={styles.muted}>Tutarı yaz</Text>
        </View>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor="#9CA3AF"
          maxLength={12}
          selectTextOnFocus
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={onRefresh} style={styles.retryBtn}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.hint}>Bir para birimine dokununca taban onu yapar</Text>
      )}

      <FlatList
        style={styles.listFlex}
        data={CURRENCIES}
        keyExtractor={(item) => item.code}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F766E" />
        }
      />

      {adsReady ? (
        <View style={[styles.banner, { paddingBottom: insets.bottom }]}>
          <BannerAd unitId={BANNER_UNIT_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 30, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  muted: { fontSize: 13, color: '#64748B' },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  baseFlag: { fontSize: 32 },
  inputTextWrap: { flex: 1 },
  baseCode: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  input: {
    minWidth: 120,
    textAlign: 'right',
    fontSize: 26,
    fontWeight: '700',
    color: '#0F766E',
    padding: 0,
  },
  hint: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 14,
    marginBottom: 2,
  },
  listFlex: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  rowActive: { borderColor: '#0F766E', backgroundColor: '#F0FDFA' },
  rowPressed: { opacity: 0.6 },
  flag: { fontSize: 26 },
  rowText: { flex: 1 },
  code: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  name: { fontSize: 12, color: '#64748B' },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  valueActive: { color: '#0F766E' },
  errorBox: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    gap: 10,
  },
  errorText: { color: '#B91C1C', textAlign: 'center', fontSize: 14 },
  retryBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  banner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
});
