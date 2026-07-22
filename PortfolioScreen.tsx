// App.tsx
// MyNestVault — Uygulama çatısı
//
//  - 3 sekme: Portfolio · Converter · Settings (bağımlılıksız, kendi tab bar'ımız)
//  - usePrices() ve usePortfolio() BİR KEZ burada kurulur, ekranlara dağıtılır
//  - AdMob banner uygulama genelinde, sekme çubuğunun üstünde
//  - Sekmeler arası geçişte ekranlar unmount edilmez (display:none) —
//    böylece çevirici arama/tutar durumu korunur, fiyatlar yeniden yüklenmez

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import mobileAds, {
  AdsConsent,
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';

import ConverterScreen from './ConverterScreen';
import PortfolioScreen from './PortfolioScreen';
import { usePrices } from './priceStore';
import { usePortfolio } from './portfolioStore';

// --- AdMob ---------------------------------------------------------------
// Kendi CANLI reklamına tıklamak AdMob hesabını KALICI olarak bloklayabilir.
// Geliştirme/test boyunca true kalmalı (test reklamı gösterir).
// !!! PRODUCTION BUILD ALMADAN ÖNCE false YAP !!!
const USE_TEST_ADS = true;

const REAL_BANNER_UNIT_ID = 'ca-app-pub-2984878117732696/7056959989';
const BANNER_UNIT_ID = USE_TEST_ADS ? TestIds.BANNER : REAL_BANNER_UNIT_ID;
// ------------------------------------------------------------------------

type TabId = 'portfolio' | 'converter' | 'settings';

// Uygulama kilidi tercihi cihazda saklanır
const LOCK_KEY = '@mynestvault/app_lock';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'portfolio', label: 'Portfolio', icon: '🪺' },
  { id: 'converter', label: 'Converter', icon: '⇄' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabId>('portfolio');
  const [adsReady, setAdsReady] = useState(false);

  // --- Uygulama kilidi ---------------------------------------------------
  const [lockEnabled, setLockEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const lockEnabledRef = useRef(false);

  useEffect(() => {
    lockEnabledRef.current = lockEnabled;
  }, [lockEnabled]);

  // Kayıtlı tercihi yükle; kilit açıksa uygulama kilitli başlar
  useEffect(() => {
    AsyncStorage.getItem(LOCK_KEY)
      .then((saved) => {
        if (saved === '1') {
          setLockEnabled(true);
          setLocked(true);
        }
      })
      .catch(() => {});
  }, []);

  const tryUnlock = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock MyNestVault',
        cancelLabel: 'Cancel',
      });
      if (result.success) setLocked(false);
    } catch {
      // Kimlik doğrulama açılamadı; kullanıcı Unlock butonuyla tekrar dener
    }
  }, []);

  // Kilitlenince doğrulama istemini otomatik göster
  useEffect(() => {
    if (locked) tryUnlock();
  }, [locked, tryUnlock]);

  // Arka plana geçince yeniden kilitle (uygulama değiştiricide de içerik gizlenir)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' && lockEnabledRef.current) {
        setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  const onToggleLock = useCallback(async (value: boolean) => {
    if (value) {
      const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
      if (!enrolled) {
        Alert.alert(
          'Device lock required',
          "To use App Lock, first set up a screen lock (PIN, pattern or fingerprint) in your phone's settings."
        );
        return;
      }
    }
    setLockEnabled(value);
    AsyncStorage.setItem(LOCK_KEY, value ? '1' : '0').catch(() => {});
  }, []);
  // -----------------------------------------------------------------------

  // Merkezi depolar — tüm uygulamada tek örnek
  const prices = usePrices();
  const portfolio = usePortfolio();

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

  const show = (visible: boolean) =>
    visible ? styles.screenVisible : styles.screenHidden;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Ekranlar: aktif olmayanlar gizlenir ama unmount edilmez */}
      <View style={styles.screens}>
        <View style={show(tab === 'portfolio')}>
          <PortfolioScreen prices={prices} portfolio={portfolio} />
        </View>
        <View style={show(tab === 'converter')}>
          <ConverterScreen prices={prices} />
        </View>
        <View style={show(tab === 'settings')}>
          <SettingsScreen lockEnabled={lockEnabled} onToggleLock={onToggleLock} />
        </View>
      </View>

      {/* Uygulama geneli banner */}
      {adsReady ? (
        <View style={styles.banner}>
          <BannerAd unitId={BANNER_UNIT_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
        </View>
      ) : null}

      {/* Sekme çubuğu */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={({ pressed }) => [styles.tabItem, pressed && styles.tabPressed]}
            >
              <Text style={[styles.tabIcon, active && styles.tabIconActive]}>
                {t.icon}
              </Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Kilit ekranı — her şeyin üstünde */}
      {locked ? (
        <View style={styles.lockScreen}>
          <Text style={styles.lockEmoji}>🔒</Text>
          <Text style={styles.lockTitle}>MyNestVault is locked</Text>
          <Text style={styles.lockHint}>
            Unlock with your fingerprint or screen lock.
          </Text>
          <Pressable
            onPress={tryUnlock}
            style={({ pressed }) => [styles.lockBtn, pressed && styles.tabPressed]}
          >
            <Text style={styles.lockBtnText}>Unlock</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Ayarlar (v1 yer tutucu — dil seçimi ve diğerleri sonraki adımlarda)
// ---------------------------------------------------------------------------

function SettingsScreen({
  lockEnabled,
  onToggleLock,
}: {
  lockEnabled: boolean;
  onToggleLock: (value: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.settingsRoot}>
      <LinearGradient
        colors={['#0F5856', '#168E78']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.settingsHeader, { paddingTop: insets.top + 14 }]}
      >
        <Text style={styles.settingsTitle}>Settings</Text>
        <View style={styles.settingsAccent} />
      </LinearGradient>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsAppName}>MyNestVault</Text>
        <Text style={styles.settingsInfo}>Gold & Assets Tracker</Text>
      </View>

      <View style={styles.settingsCard}>
        <View style={styles.settingsRow}>
          <View style={styles.settingsRowText}>
            <Text style={styles.settingsPrivacyTitle}>🔐 App Lock</Text>
            <Text style={styles.settingsInfo}>
              Require your phone's fingerprint or screen lock to open the app.
            </Text>
          </View>
          <Switch
            value={lockEnabled}
            onValueChange={onToggleLock}
            trackColor={{ true: '#6CDEBC', false: '#D6DEDD' }}
            thumbColor={lockEnabled ? '#16A382' : '#FFFFFF'}
          />
        </View>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsPrivacyTitle}>🔒 Private by design</Text>
        <Text style={styles.settingsInfo}>
          All your assets are stored only on this device. Nothing is uploaded
          anywhere.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F8F7' },
  screens: { flex: 1 },
  screenVisible: { flex: 1, display: 'flex' },
  screenHidden: { flex: 1, display: 'none' },

  // Banner
  banner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8EEED',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8EEED',
    paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 2 },
  tabPressed: { opacity: 0.6 },
  tabIcon: { fontSize: 20, color: '#9AA8A7' },
  tabIconActive: { color: '#16A382' },
  tabLabel: { fontSize: 11, fontWeight: '600', color: '#9AA8A7' },
  tabLabelActive: { color: '#0F5856', fontWeight: '800' },

  // Settings
  settingsRoot: { flex: 1, backgroundColor: '#F4F8F7' },
  settingsHeader: {
    paddingHorizontal: 24,
    paddingBottom: 22,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  settingsTitle: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  settingsAccent: {
    marginTop: 10,
    width: 64,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#6CDEBC',
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECF1F0',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
  },
  settingsAppName: { fontSize: 18, fontWeight: '800', color: '#122E30' },
  settingsPrivacyTitle: { fontSize: 15, fontWeight: '800', color: '#122E30', marginBottom: 6 },
  settingsInfo: { fontSize: 13, color: '#78888A', marginTop: 2, lineHeight: 19 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsRowText: { flex: 1 },

  // Kilit ekranı
  lockScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F5856',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    zIndex: 100,
  },
  lockEmoji: { fontSize: 56 },
  lockTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 16,
    textAlign: 'center',
  },
  lockHint: {
    fontSize: 14,
    color: '#CFEDE5',
    marginTop: 8,
    textAlign: 'center',
  },
  lockBtn: {
    marginTop: 28,
    backgroundColor: '#6CDEBC',
    borderRadius: 18,
    paddingHorizontal: 40,
    paddingVertical: 14,
  },
  lockBtnText: { color: '#0C3C37', fontSize: 16, fontWeight: '800' },
});
