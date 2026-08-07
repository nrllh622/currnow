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
  BackHandler,
  Linking,
  Pressable,
  ScrollView,
  Share,
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
import * as ScreenCapture from 'expo-screen-capture';
import mobileAds, {
  AdsConsent,
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';

import ConverterScreen from './ConverterScreen';
import PortfolioScreen from './PortfolioScreen';
import ConfirmDialog from './ConfirmDialog';
import { LanguageProvider, useT, type Lang } from './i18n';
import { usePrices } from './priceStore';
import { usePortfolio } from './portfolioStore';
import { checkForUpdate } from './inAppUpdate';

// --- AdMob ---------------------------------------------------------------
// Kendi CANLI reklamına tıklamak AdMob hesabını KALICI olarak bloklayabilir.
// Geliştirme/test boyunca true kalmalı (test reklamı gösterir).
// !!! PRODUCTION BUILD ALMADAN ÖNCE false YAP !!!
const USE_TEST_ADS = false;

const REAL_BANNER_UNIT_ID = 'ca-app-pub-2984878117732696/7056959989';
const BANNER_UNIT_ID = USE_TEST_ADS ? TestIds.BANNER : REAL_BANNER_UNIT_ID;
// ------------------------------------------------------------------------

// Uygulamanın Play Store adresi (paylaşım ve puanlama için)
const PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.currnow.app';

type TabId = 'portfolio' | 'converter' | 'settings';

// Uygulama kilidi tercihi cihazda saklanır
const LOCK_KEY = '@mynestvault/app_lock';

const TABS: { id: TabId; labelKey: string; icon: string }[] = [
  { id: 'portfolio', labelKey: 'tabs.portfolio', icon: '🪺' },
  { id: 'converter', labelKey: 'tabs.converter', icon: '⇄' },
  { id: 'settings', labelKey: 'tabs.settings', icon: '⚙' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <Root />
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const [tab, setTab] = useState<TabId>('portfolio');
  // Portfolio sekmesine basıldığında artan sayaç — zaten Portfolio'dayken
  // basılsa bile (Varlık Ekle kaplaması açıkken) PortfolioScreen'e "kaplamaları
  // kapat" sinyali gönderir.
  const [portfolioResetSignal, setPortfolioResetSignal] = useState(0);
  const [adsReady, setAdsReady] = useState(false);

  // --- Uygulama kilidi ---------------------------------------------------
  const [lockEnabled, setLockEnabled] = useState(false);
  // Kilit tercihi diskten okunana kadar hiçbir içerik gösterilmez
  const [lockChecked, setLockChecked] = useState(false);
  // "Cihaz kilidi gerekli" bilgi diyaloğu
  const [showLockRequired, setShowLockRequired] = useState(false);
  const [locked, setLocked] = useState(false);
  const lockEnabledRef = useRef(false);
  const lockedRef = useRef(false);
  const authBusyRef = useRef(false);

  useEffect(() => {
    lockEnabledRef.current = lockEnabled;
  }, [lockEnabled]);

  // Açılışta Play'de yeni sürüm var mı kontrol et (yalnızca gerçek Play sürümü)
  useEffect(() => {
    checkForUpdate();
  }, []);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  // Kayıtlı tercihi yükle; kilit açıksa uygulama kilitli başlar
  useEffect(() => {
    AsyncStorage.getItem(LOCK_KEY)
      .then((saved) => {
        if (saved === '1') {
          setLockEnabled(true);
          setLocked(true);
        }
      })
      .catch(() => {})
      .finally(() => setLockChecked(true));
  }, []);

  // Kilit açıkken ekran görüntüsü ve "son uygulamalar" önizlemesi engellenir
  useEffect(() => {
    if (lockEnabled) {
      ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    } else {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    }
  }, [lockEnabled]);

  // Tek doğrulama kapısı: çakışmayı önler, takılı oturumu temizler
  const doAuthenticate = useCallback(async (message: string): Promise<boolean> => {
    if (authBusyRef.current) return false;
    authBusyRef.current = true;
    try {
      try {
        await LocalAuthentication.cancelAuthenticate();
      } catch {
        // Android dışı veya temizlenecek oturum yoksa sorun değil
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: message,
        cancelLabel: 'Cancel',
      });
      return result.success;
    } catch {
      return false;
    } finally {
      authBusyRef.current = false;
    }
  }, []);

  const tryUnlock = useCallback(async () => {
    const ok = await doAuthenticate(t('lock.promptUnlock'));
    if (ok) setLocked(false);
  }, [doAuthenticate, t]);

  // Kilitlenince doğrulamayı otomatik başlat — YALNIZCA uygulama öndeyken
  useEffect(() => {
    if (locked && AppState.currentState === 'active') tryUnlock();
  }, [locked, tryUnlock]);

  // Arka plana geçince kilitle; öne dönünce doğrulamayı başlat
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' && lockEnabledRef.current) {
        setLocked(true);
      }
      if (state === 'active' && lockedRef.current) {
        tryUnlock();
      }
    });
    return () => sub.remove();
  }, [tryUnlock]);

  // Sekme düzeyinde geri tuşu: Portfolio dışındaki bir sekmedeyken
  // geri tuşu ana sekmeye (Portfolio) döner; zaten Portfolio'daysa
  // olayı işlemez, Android uygulamayı arka plana alır.
  // (Kaplama ekranları — varlık ekleme/liste/para seçici — kendi
  //  BackHandler'ları ile önce çalışır ve olayı tüketir.)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (locked) return true; // kilitliyken geri tuşu bir şey yapmasın
      if (tab !== 'portfolio') {
        setTab('portfolio');
        return true;
      }
      return false; // Portfolio'da: varsayılan davranış (arka plana al)
    });
    return () => sub.remove();
  }, [tab, locked]);

  const onToggleLock = useCallback(
    async (value: boolean) => {
      if (value) {
        // Biyometri VEYA PIN/desen — herhangi bir cihaz kilidi yeterli
        let level = LocalAuthentication.SecurityLevel.NONE;
        try {
          level = await LocalAuthentication.getEnrolledLevelAsync();
        } catch {
          // Yerel modül yüklü değilse (eski build) NONE kalır
        }
        if (level === LocalAuthentication.SecurityLevel.NONE) {
          setShowLockRequired(true);
          return;
        }
        // Etkinleştirmeden önce kimliği doğrula
        const ok = await doAuthenticate(t('lock.promptEnable'));
        if (!ok) return;
      } else {
        // KAPATIRKEN de doğrula — asıl korunması gereken yön burası:
        // telefonu eline alan biri kilidi sessizce kapatamamalı.
        const ok = await doAuthenticate(t('lock.promptDisable'));
        if (!ok) return;
      }
      setLockEnabled(value);
      AsyncStorage.setItem(LOCK_KEY, value ? '1' : '0').catch(() => {});
    },
    [doAuthenticate, t]
  );
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
          <PortfolioScreen
            prices={prices}
            portfolio={portfolio}
            isActive={tab === 'portfolio'}
            resetSignal={portfolioResetSignal}
          />
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
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                if (item.id === 'portfolio') {
                  // Portfolio'ya her basışta kaplamaları kapat (zaten oradaysak bile)
                  setPortfolioResetSignal((n) => n + 1);
                }
                setTab(item.id);
              }}
              style={({ pressed }) => [styles.tabItem, pressed && styles.tabPressed]}
            >
              <Text style={[styles.tabIcon, active && styles.tabIconActive]}>
                {item.icon}
              </Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {t(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Kilit ekranı — her şeyin üstünde.
          Tercih diskten okunana kadar (lockChecked=false) içerik gizli kalır,
          böylece kilitli açılışta ana ekran bir an bile görünmez. */}
      {!lockChecked ? (
        <View style={styles.lockScreen} />
      ) : null}

      {/* Cihazda ekran kilidi kurulu değilse bilgilendirme */}
      <ConfirmDialog
        visible={showLockRequired}
        title={t('lock.requiredTitle')}
        message={t('lock.requiredMsg')}
        confirmLabel={t('common.gotIt')}
        onConfirm={() => setShowLockRequired(false)}
      />

      {locked && lockChecked ? (
        <View style={styles.lockScreen}>
          <Text style={styles.lockEmoji}>🔒</Text>
          <Text style={styles.lockTitle}>{t('lock.title')}</Text>
          <Text style={styles.lockHint}>{t('lock.hint')}</Text>
          <Pressable
            onPress={tryUnlock}
            style={({ pressed }) => [styles.lockBtn, pressed && styles.tabPressed]}
          >
            <Text style={styles.lockBtnText}>{t('lock.unlock')}</Text>
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
  const { t, lang, setLang } = useT();

  const LANGS: { id: Lang; label: string }[] = [
    { id: 'en', label: 'English' },
    { id: 'tr', label: 'Türkçe' },
  ];

  const onShare = useCallback(async () => {
    try {
      await Share.share({
        message: `${t('settings.shareText')}\n${PLAY_URL}`,
      });
    } catch {
      // paylaşım iptal edilirse sessizce geç
    }
  }, [t]);

  const onRate = useCallback(async () => {
    // Kullanıcının bilerek bastığı "puan ver" butonu her zaman Play mağaza
    // sayfasını açar — öngörülebilir davranış. (Uygulama içi puan penceresi
    // Google tarafından kotalıdır ve çağrıldığında sessizce hiçbir şey
    // yapabilir; buton için bu kafa karıştırıcı olur.)
    try {
      await Linking.openURL('market://details?id=com.currnow.app');
    } catch {
      // Play uygulaması yoksa web linkine düş
      Linking.openURL(PLAY_URL).catch(() => {});
    }
  }, []);

  return (
    <View style={styles.settingsRoot}>
      <LinearGradient
        colors={['#0F5856', '#168E78']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.settingsHeader, { paddingTop: insets.top + 14 }]}
      >
        <Text style={styles.settingsTitle}>{t('settings.title')}</Text>
        <View style={styles.settingsAccent} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.settingsScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.settingsCard}>
          <Text style={styles.settingsAppName}>MyNestVault</Text>
          <Text style={styles.settingsInfo}>{t('settings.tagline')}</Text>
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.settingsPrivacyTitle}>{t('settings.language')}</Text>
          <View style={styles.langRow}>
            {LANGS.map((l) => {
              const active = lang === l.id;
              return (
                <Pressable
                  key={l.id}
                  onPress={() => setLang(l.id)}
                  style={[styles.langChip, active && styles.langChipActive]}
                >
                  <Text style={[styles.langText, active && styles.langTextActive]}>
                    {l.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.settingsCard}>
          <View style={styles.settingsRow}>
            <View style={styles.settingsRowText}>
              <Text style={styles.settingsPrivacyTitle}>
                {t('settings.appLock')}
              </Text>
              <Text style={styles.settingsInfo}>{t('settings.appLockDesc')}</Text>
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
          <Text style={styles.settingsPrivacyTitle}>{t('settings.privacy')}</Text>
          <Text style={styles.settingsInfo}>{t('settings.privacyDesc')}</Text>
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.settingsPrivacyTitle}>{t('settings.prices')}</Text>
          <Text style={styles.settingsInfo}>{t('settings.pricesDesc')}</Text>
        </View>

        <View style={styles.settingsCard}>
          <Pressable
            onPress={onShare}
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionPressed]}
          >
            <Text style={styles.actionIcon}>📤</Text>
            <Text style={styles.actionLabel}>{t('settings.share')}</Text>
            <Text style={styles.actionChevron}>›</Text>
          </Pressable>
          <View style={styles.actionDivider} />
          <Pressable
            onPress={onRate}
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionPressed]}
          >
            <Text style={styles.actionIcon}>⭐</Text>
            <Text style={styles.actionLabel}>{t('settings.rate')}</Text>
            <Text style={styles.actionChevron}>›</Text>
          </Pressable>
        </View>
      </ScrollView>
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
  settingsScroll: { paddingBottom: 24 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  actionPressed: { opacity: 0.6 },
  actionIcon: { fontSize: 18, marginRight: 12 },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#122E30' },
  actionChevron: { fontSize: 22, color: '#9CA3AF' },
  actionDivider: { height: 1, backgroundColor: '#EEF3F2', marginVertical: 4 },
  langRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  langChip: {
    flex: 1,
    backgroundColor: '#F1F5F4',
    borderWidth: 1,
    borderColor: '#E2E9E8',
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  langChipActive: { backgroundColor: '#EFFAF6', borderColor: '#16A382' },
  langText: { fontSize: 15, fontWeight: '700', color: '#78888A' },
  langTextActive: { color: '#0F5856', fontWeight: '800' },

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
