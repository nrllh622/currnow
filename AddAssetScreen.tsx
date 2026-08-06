// AddAssetScreen.tsx
// MyNestVault — Varlık ekleme akışı
// Adım 1: tip seç (11 tip) → Adım 2: tipe göre alanlar → Kaydet
// Tam ekran kaplama (overlay) olarak çalışır; navigasyon bağımlılığı yoktur.

import React, { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ASSET_TYPES,
  GOLD_PIECES,
  KARAT_PURITY,
  getAssetType,
} from './assetTypes';
import { Currency, CURATED, buildCurrencyList } from './currencies';
import type { PriceState } from './priceStore';
import type { Asset } from './portfolioStore';
import { useT, pickLabel } from './i18n';
import { CRYPTO_COINS, getCryptoCoin } from './cryptoList';

type NewAsset = Omit<Asset, 'id' | 'createdAt'>;

interface Props {
  visible: boolean;
  prices: PriceState;
  onClose: () => void;
  onSave: (asset: NewAsset) => void;
}

function parseNum(s: string): number {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

const KARAT_KEYS = Object.keys(KARAT_PURITY);

export default function AddAssetScreen({ visible, prices, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const { t, lang } = useT();

  const [typeId, setTypeId] = useState<string | null>(null);

  // Form alanları (hepsi metin olarak tutulur, kayıtta sayıya çevrilir)
  const [label, setLabel] = useState('');
  const [personName, setPersonName] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [amount, setAmount] = useState('');
  const [goldMode, setGoldMode] = useState<'piece' | 'weight'>('piece');
  const [pieceId, setPieceId] = useState('ceyrek');
  const [count, setCount] = useState('1');
  const [weight, setWeight] = useState(''); // gram (bakırda kg)
  const [karatKey, setKaratKey] = useState('22k');
  const [units, setUnits] = useState('');
  const [coinId, setCoinId] = useState('bitcoin'); // 'crypto' tipi için seçili coin
  const [coinPicking, setCoinPicking] = useState(false);
  const [coinSearch, setCoinSearch] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [manualCurrency, setManualCurrency] = useState('USD');
  const [purchaseValue, setPurchaseValue] = useState('');
  const [purchaseCurrency, setPurchaseCurrency] = useState('USD');

  // Para birimi seçici kaplaması: hangi alan için açık?
  const [pickerFor, setPickerFor] = useState<
    null | 'currency' | 'manual' | 'purchase'
  >(null);
  const [pickerSearch, setPickerSearch] = useState('');

  const type = typeId ? getAssetType(typeId) : undefined;

  const allCurrencies: Currency[] = useMemo(() => {
    const rates = prices.snapshot ? prices.snapshot.fxRates : null;
    if (rates) return buildCurrencyList(Object.keys(rates));
    return CURATED;
  }, [prices.snapshot]);

  const filteredCurrencies = useMemo(() => {
    const q = pickerSearch.trim().toUpperCase();
    if (!q) return allCurrencies;
    return allCurrencies.filter(
      (c) => c.code.includes(q) || c.name.toUpperCase().includes(q)
    );
  }, [allCurrencies, pickerSearch]);

  const resetForm = () => {
    setTypeId(null);
    setLabel('');
    setPersonName('');
    setCurrencyCode('USD');
    setAmount('');
    setGoldMode('piece');
    setPieceId('ceyrek');
    setCount('1');
    setWeight('');
    setKaratKey('22k');
    setUnits('');
    setCoinId('bitcoin');
    setCoinPicking(false);
    setCoinSearch('');
    setManualValue('');
    setManualCurrency('USD');
    setPurchaseValue('');
    setPurchaseCurrency('USD');
    setPickerFor(null);
    setPickerSearch('');
  };

  const close = () => {
    resetForm();
    onClose();
  };

  // Donanım geri tuşu: açık olan en içteki katmanı geri alır
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (coinPicking) {
        setCoinPicking(false);
        setCoinSearch('');
        return true;
      }
      if (pickerFor) {
        setPickerFor(null);
        setPickerSearch('');
        return true;
      }
      if (typeId) {
        setTypeId(null);
        return true;
      }
      close();
      return true;
    });
    return () => sub.remove();
  }, [visible, pickerFor, typeId, coinPicking]);

  // ------------------------------------------------------------------
  // Doğrulama: Kaydet butonu ancak geçerli girdiyle aktif olur
  // ------------------------------------------------------------------
  const canSave = useMemo(() => {
    if (!type) return false;
    switch (type.valuationClass) {
      case 'FX': {
        if (parseNum(amount) <= 0) return false;
        if (type.id === 'lent' && personName.trim().length === 0) return false;
        return true;
      }
      case 'METAL': {
        if (type.id === 'gold' && goldMode === 'piece') {
          return parseNum(count) >= 1;
        }
        return parseNum(weight) > 0;
      }
      case 'CRYPTO':
        return parseNum(units) > 0;
      case 'MANUAL': {
        if (parseNum(manualValue) <= 0) return false;
        if (type.id === 'other' && label.trim().length === 0) return false;
        return true;
      }
      default:
        return false;
    }
  }, [type, amount, personName, goldMode, count, weight, units, manualValue, label]);

  const save = () => {
    if (!type || !canSave) return;

    const asset: NewAsset = { typeId: type.id };
    if (label.trim()) asset.label = label.trim();

    switch (type.valuationClass) {
      case 'FX': {
        asset.currencyCode = currencyCode;
        asset.amount = parseNum(amount);
        if (type.id === 'lent') asset.personName = personName.trim();
        break;
      }
      case 'METAL': {
        if (type.id === 'gold' && goldMode === 'piece') {
          asset.pieceId = pieceId;
          asset.count = parseNum(count);
        } else if (type.id === 'gold') {
          asset.weightGrams = parseNum(weight);
          asset.purity = KARAT_PURITY[karatKey];
        } else if (type.id === 'copper') {
          asset.weightGrams = parseNum(weight) * 1000; // giriş kg
        } else {
          asset.weightGrams = parseNum(weight);
        }
        break;
      }
      case 'CRYPTO': {
        asset.units = parseNum(units);
        // Genişletilmiş kripto tipinde seçilen coin kaydedilir
        if (type.id === 'crypto') asset.coingeckoId = coinId;
        break;
      }
      case 'MANUAL': {
        asset.manualValue = parseNum(manualValue);
        asset.manualCurrency = manualCurrency;
        break;
      }
    }

    if (parseNum(purchaseValue) > 0) {
      asset.purchaseValue = parseNum(purchaseValue);
      asset.purchaseCurrency = purchaseCurrency;
    }

    onSave(asset);
    resetForm();
  };

  if (!visible) return null;

  // ------------------------------------------------------------------
  // Para birimi seçici (kaplama)
  // ------------------------------------------------------------------
  if (pickerFor) {
    const select = (code: string) => {
      if (pickerFor === 'currency') setCurrencyCode(code);
      if (pickerFor === 'manual') setManualCurrency(code);
      if (pickerFor === 'purchase') setPurchaseCurrency(code);
      setPickerFor(null);
      setPickerSearch('');
    };
    return (
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setPickerFor(null)} hitSlop={10}>
            <Text style={styles.topBarAction}>‹ {t('common.back')}</Text>
          </Pressable>
          <Text style={styles.topBarTitle}>{t('add.selectCurrency')}</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            value={pickerSearch}
            onChangeText={setPickerSearch}
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
          renderItem={({ item }) => (
            <Pressable
              onPress={() => select(item.code)}
              style={({ pressed }) => [styles.currencyRow, pressed && styles.pressed]}
            >
              <View style={[styles.badge, { backgroundColor: item.color }]}>
                <Text style={styles.badgeText}>{item.symbol}</Text>
              </View>
              <View style={styles.currencyText}>
                <Text style={styles.currencyCode}>{item.code}</Text>
                <Text style={styles.currencyName} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    );
  }

  // ------------------------------------------------------------------
  // Coin seçici (kaplama) — 'crypto' tipi için
  // ------------------------------------------------------------------
  if (coinPicking) {
    const q = coinSearch.trim().toUpperCase();
    const filteredCoins = q
      ? CRYPTO_COINS.filter(
          (c) => c.symbol.includes(q) || c.name.toUpperCase().includes(q)
        )
      : CRYPTO_COINS;
    return (
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setCoinPicking(false)} hitSlop={10}>
            <Text style={styles.topBarAction}>‹ {t('common.back')}</Text>
          </Pressable>
          <Text style={styles.topBarTitle}>{t('add.selectCoin')}</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            value={coinSearch}
            onChangeText={setCoinSearch}
            placeholder={t('add.searchCoin')}
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>
        <FlatList
          data={filteredCoins}
          keyExtractor={(item) => item.coingeckoId}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const active = item.coingeckoId === coinId;
            return (
              <Pressable
                onPress={() => {
                  setCoinId(item.coingeckoId);
                  setCoinPicking(false);
                  setCoinSearch('');
                }}
                style={({ pressed }) => [
                  styles.currencyRow,
                  active && styles.coinRowActive,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.badge, { backgroundColor: '#B8860B' }]}>
                  <Text style={styles.badgeText}>{item.symbol.slice(0, 3)}</Text>
                </View>
                <View style={styles.currencyText}>
                  <Text style={styles.currencyCode}>{item.symbol}</Text>
                  <Text style={styles.currencyName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                {active ? <Text style={styles.coinCheck}>✓</Text> : null}
              </Pressable>
            );
          }}
        />
      </View>
    );
  }

  // ------------------------------------------------------------------
  // Adım 1: tip seçimi
  // ------------------------------------------------------------------
  if (!type) {
    return (
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable onPress={close} hitSlop={10}>
            <Text style={styles.topBarAction}>✕ {t('common.cancel')}</Text>
          </Pressable>
          <Text style={styles.topBarTitle}>{t('add.title')}</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.typeGridContent}>
          <Text style={styles.stepHint}>{t('add.question')}</Text>
          <View style={styles.typeGrid}>
            {ASSET_TYPES.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setTypeId(item.id)}
                style={({ pressed }) => [styles.typeCard, pressed && styles.pressed]}
              >
                <Text style={styles.typeEmoji}>{item.emoji}</Text>
                <Text style={styles.typeLabel}>{pickLabel(item, lang)}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ------------------------------------------------------------------
  // Adım 2: tipe göre form
  // ------------------------------------------------------------------
  const currencyField = (
    labelText: string,
    code: string,
    target: 'currency' | 'manual' | 'purchase'
  ) => (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{labelText}</Text>
      <Pressable
        onPress={() => setPickerFor(target)}
        style={({ pressed }) => [styles.currencyBtn, pressed && styles.pressed]}
      >
        <Text style={styles.currencyBtnText}>{code}</Text>
        <Text style={styles.currencyBtnChevron}>▾</Text>
      </Pressable>
    </View>
  );

  const numberField = (
    labelText: string,
    value: string,
    setValue: (s: string) => void,
    placeholder: string
  ) => (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{labelText}</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );

  const textField = (
    labelText: string,
    value: string,
    setValue: (s: string) => void,
    placeholder: string
  ) => (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{labelText}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );

  const chips = (
    options: { key: string; text: string }[],
    selected: string,
    onSelect: (k: string) => void
  ) => (
    <View style={styles.chipsWrap}>
      {options.map((o) => {
        const active = o.key === selected;
        return (
          <Pressable
            key={o.key}
            onPress={() => onSelect(o.key)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {o.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.overlay, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => setTypeId(null)} hitSlop={10}>
          <Text style={styles.topBarAction}>‹ {t('common.back')}</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>
          {type.emoji} {pickLabel(type, lang)}
        </Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={true}
        showsVerticalScrollIndicator={false}
      >
        {/* --- FX: nakit döviz + alacaklar --- */}
        {type.valuationClass === 'FX' ? (
          <>
            {type.id === 'lent'
              ? textField(t('add.whoOwes'), personName, setPersonName, t('add.phPerson'))
              : null}
            {currencyField(t('add.currency'), currencyCode, 'currency')}
            {numberField(t('add.amount'), amount, setAmount, '0')}
          </>
        ) : null}

        {/* --- METAL --- */}
        {type.valuationClass === 'METAL' ? (
          <>
            {type.id === 'gold' ? (
              <>
                <Text style={styles.fieldLabel}>{t('add.entryType')}</Text>
                {chips(
                  [
                    { key: 'piece', text: t('add.modePiece') },
                    { key: 'weight', text: t('add.modeWeight') },
                  ],
                  goldMode,
                  (k) => setGoldMode(k as 'piece' | 'weight')
                )}
                {goldMode === 'piece' ? (
                  <>
                    <Text style={styles.fieldLabel}>{t('add.piece')}</Text>
                    {chips(
                      GOLD_PIECES.map((p) => ({ key: p.id, text: pickLabel(p, lang) })),
                      pieceId,
                      setPieceId
                    )}
                    {numberField(t('add.count'), count, setCount, '1')}
                  </>
                ) : (
                  <>
                    {numberField(t('add.weightGram'), weight, setWeight, '0')}
                    <Text style={styles.fieldLabel}>{t('add.karat')}</Text>
                    {chips(
                      KARAT_KEYS.map((k) => ({ key: k, text: k })),
                      karatKey,
                      setKaratKey
                    )}
                  </>
                )}
              </>
            ) : type.id === 'copper' ? (
              numberField(t('add.weightKg'), weight, setWeight, '0')
            ) : (
              numberField(t('add.weightGram'), weight, setWeight, '0')
            )}
          </>
        ) : null}

        {/* --- CRYPTO --- */}
        {type.valuationClass === 'CRYPTO' ? (
          type.id === 'crypto' ? (
            <>
              <Text style={styles.fieldLabel}>{t('add.coin')}</Text>
              <Pressable
                onPress={() => setCoinPicking(true)}
                style={({ pressed }) => [styles.currencyBtn, pressed && styles.pressed]}
              >
                <Text style={styles.currencyBtnText}>
                  {getCryptoCoin(coinId)?.name ?? 'Bitcoin'} (
                  {getCryptoCoin(coinId)?.symbol ?? 'BTC'})
                </Text>
                <Text style={styles.currencyBtnChevron}>▾</Text>
              </Pressable>
              {numberField(
                t('add.cryptoAmount', {
                  symbol: getCryptoCoin(coinId)?.symbol ?? '',
                }),
                units,
                setUnits,
                '0'
              )}
            </>
          ) : (
            numberField(
              t('add.cryptoAmount', { symbol: type.symbol ?? '' }),
              units,
              setUnits,
              '0'
            )
          )
        ) : null}

        {/* --- MANUAL: ziynet + diğer --- */}
        {type.valuationClass === 'MANUAL' ? (
          <>
            {type.id === 'other'
              ? textField(t('add.assetName'), label, setLabel, t('add.phOther'))
              : null}
            {numberField(t('add.estValue'), manualValue, setManualValue, '0')}
            {currencyField(t('add.valueCurrency'), manualCurrency, 'manual')}
          </>
        ) : null}

        {/* --- Ortak opsiyoneller --- */}
        {type.id !== 'other'
          ? textField(t('add.nameOptional'), label, setLabel, t('add.phName'))
          : null}

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>{t('add.purchaseTitle')}</Text>
        <Text style={styles.sectionHint}>{t('add.purchaseHint')}</Text>
        {numberField(t('add.purchaseValue'), purchaseValue, setPurchaseValue, '0')}
        {currencyField(t('add.purchaseCurrency'), purchaseCurrency, 'purchase')}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          onPress={save}
          disabled={!canSave}
          style={({ pressed }) => [
            styles.saveBtn,
            !canSave && styles.saveBtnDisabled,
            pressed && canSave && styles.pressed,
          ]}
        >
          <Text style={styles.saveBtnText}>{t('common.save')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const TEAL = '#16A382';
const INK = '#122E30';
const GREY = '#78888A';

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F4F8F7',
    zIndex: 10,
  },
  pressed: { opacity: 0.6 },

  // Üst bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  topBarAction: { fontSize: 15, fontWeight: '700', color: TEAL },
  topBarTitle: { fontSize: 17, fontWeight: '800', color: INK },
  topBarSpacer: { width: 60 },

  // Tip seçimi
  typeGridContent: { paddingBottom: 30 },
  stepHint: {
    fontSize: 14,
    color: GREY,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  typeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECF1F0',
    width: '29.3%',
    marginHorizontal: '2%',
    marginBottom: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  typeEmoji: { fontSize: 26 },
  typeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: INK,
    marginTop: 6,
    textAlign: 'center',
  },

  // Form
  formContent: { paddingHorizontal: 16, paddingBottom: 120 },
  fieldBlock: { marginTop: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: GREY, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EEED',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: INK,
  },
  currencyBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EEED',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currencyBtnText: { fontSize: 16, fontWeight: '700', color: INK },
  currencyBtnChevron: { fontSize: 14, color: GREY },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EEED',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: '#EFFAF6', borderColor: TEAL },
  chipText: { fontSize: 13, fontWeight: '600', color: GREY },
  chipTextActive: { color: '#0F5856', fontWeight: '800' },

  divider: { height: 1, backgroundColor: '#E8EEED', marginTop: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: INK, marginTop: 16 },
  sectionHint: { fontSize: 12, color: GREY, marginTop: 3 },

  // Alt bar
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#F4F8F7',
  },
  saveBtn: {
    backgroundColor: TEAL,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#B9D6CF' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // Para birimi seçici
  searchWrap: {
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
  searchIcon: { fontSize: 22, color: GREY, marginTop: -2 },
  searchInput: { flex: 1, fontSize: 15, color: INK, padding: 0 },
  currencyRow: {
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
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  currencyText: { flex: 1 },
  currencyCode: { fontSize: 16, fontWeight: '700', color: INK },
  currencyName: { fontSize: 12, color: GREY, marginTop: 1 },
  coinRowActive: { borderColor: '#E8C97A', backgroundColor: '#FDF9EF' },
  coinCheck: { fontSize: 18, fontWeight: '800', color: '#B8860B' },
});
