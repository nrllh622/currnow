// App.tsx
// MyNestVault — Uygulama çatısı
//
//  - 3 sekme: Portfolio · Converter · Settings (bağımlılıksız, kendi tab bar'ımız)
//  - usePrices() ve usePortfolio() BİR KEZ burada kurulur, ekranlara dağıtılır
//  - AdMob banner uygulama genelinde, sekme çubuğunun üstünde
//  - Sekmeler arası geçişte ekranlar unmount edilmez (display:none) —
//    böylece çevirici arama/tutar durumu korunur, fiyatlar yeniden yüklenmez

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
const USE_TEST_ADS = false;

const REAL_BANNER_UNIT_ID = 'ca-app-pub-2984878117732696/7056959989';
const BANNER_UNIT_ID = USE_TEST_ADS ? TestIds.BANNER : REAL_BANNER_UNIT_ID;
// ------------------------------------------------------------------------

type TabId = 'portfolio' | 'converter' | 'settings';

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
          <SettingsScreen />
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
    </View>
  );
}

// ---------------------------------------------------------------------------
// Ayarlar (v1 yer tutucu — dil seçimi ve diğerleri sonraki adımlarda)
// ---------------------------------------------------------------------------

function SettingsScreen() {
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
});
