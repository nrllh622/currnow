// i18n.ts
// MyNestVault — Dil desteği (EN + TR)
//
// - Tüm metinler burada; ekranlar useT() ile t('anahtar') çağırır.
// - İlk açılışta cihaz dili algılanır (Türkçe ise TR, değilse EN).
// - Kullanıcı Ayarlar'dan değiştirebilir; tercih cihazda saklanır.
// - Yerel modül gerektirmez (yeni build gerekmez).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'en' | 'tr';

const STORAGE_KEY = '@mynestvault/language';

type Dict = Record<string, string>;

// ---------------------------------------------------------------------------
// İngilizce
// ---------------------------------------------------------------------------
const en: Dict = {
  // Ortak
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.gotIt': 'Got it',
  'common.searchCurrency': 'Search currency (e.g. EUR, Yen)',
  'common.item_one': '{n} item',
  'common.item_other': '{n} items',

  // Sekmeler
  'tabs.portfolio': 'Portfolio',
  'tabs.converter': 'Converter',
  'tabs.settings': 'Settings',

  // Kilit
  'lock.title': 'MyNestVault is locked',
  'lock.hint': 'Unlock with your fingerprint or screen lock.',
  'lock.unlock': 'Unlock',
  'lock.promptUnlock': 'Unlock MyNestVault',
  'lock.promptEnable': 'Confirm to enable App Lock',
  'lock.promptDisable': 'Confirm to turn off App Lock',
  'lock.requiredTitle': 'Device lock required',
  'lock.requiredMsg':
    "To use App Lock, first set up a screen lock (PIN, pattern or fingerprint) in your phone's settings.",

  // Ayarlar
  'settings.title': 'Settings',
  'settings.tagline': 'Gold & Assets Tracker',
  'settings.language': '🌐 Language',
  'settings.appLock': '🔐 App Lock',
  'settings.appLockDesc':
    "Require your phone's fingerprint or screen lock to open the app.",
  'settings.privacy': '🔒 Private by design',
  'settings.privacyDesc':
    'All your assets are stored only on this device. Nothing is uploaded anywhere.',
  'settings.prices': 'ℹ️ About prices',
  'settings.pricesDesc':
    'Prices are estimates based on global spot market data and may be delayed. Local jeweller, dealer or exchange prices can differ due to workmanship, premiums and spreads. MyNestVault does not provide investment advice.',

  // Portföy
  'portfolio.total': 'Total Value',
  'portfolio.showTotalIn': 'Show total in',
  'portfolio.updated': 'Updated {time}',
  'portfolio.notPriced': '{n} item(s) not priced yet',
  'portfolio.emptyTitle': 'Your vault is empty',
  'portfolio.emptyDesc':
    'Add your cash, gold, silver, crypto and other valuables to see their live total value — all stored only on this device.',
  'portfolio.addAsset': '＋ Add Asset',

  // Varlık ekleme
  'add.title': 'Add Asset',
  'add.question': 'What would you like to add?',
  'add.currency': 'Currency',
  'add.amount': 'Amount *',
  'add.whoOwes': 'Who owes you? *',
  'add.entryType': 'Entry type',
  'add.modePiece': 'Piece (Çeyrek, Tam…)',
  'add.modeWeight': 'Weight (gram + karat)',
  'add.piece': 'Piece',
  'add.count': 'Count *',
  'add.weightGram': 'Weight (gram) *',
  'add.weightKg': 'Weight (kg) *',
  'add.karat': 'Karat',
  'add.cryptoAmount': 'Amount ({symbol}) *',
  'add.assetName': 'Asset name *',
  'add.estValue': 'Estimated value *',
  'add.valueCurrency': 'Value currency',
  'add.nameOptional': 'Name (optional)',
  'add.purchaseTitle': 'Purchase info (optional)',
  'add.purchaseHint': 'Enter what you paid to see gain/loss on this asset.',
  'add.purchaseValue': 'Purchase value',
  'add.purchaseCurrency': 'Purchase currency',
  'add.selectCurrency': 'Select Currency',
  'add.phPerson': 'e.g. Ahmet',
  'add.phOther': 'e.g. Land deed, Watch collection',
  'add.phName': 'e.g. Wedding gold, Home safe',

  // Varlık listesi
  'list.otherAssets': 'Other Assets',
  'list.empty': 'No assets in this group.',
  'list.deleteTitle': 'Delete asset',
  'list.deleteMsg':
    '"{name}" will be removed from your vault. This cannot be undone.',

  // Çevirici
  'conv.title': 'Converter',
  'conv.amount': 'Amount',
  'conv.convertedTo': 'Converted to',
  'conv.lastUpdated': 'Last updated: {time}',
  'conv.rates': 'Exchange Rates',
  'conv.base': 'Base: {code}',
  'conv.noMatch': 'No currency matches “{query}”.',
  'conv.loading': 'Loading rates…',
  'conv.error': 'Could not load rates. Check your connection and try again.',
  'conv.retry': 'Try again',
};

// ---------------------------------------------------------------------------
// Türkçe
// ---------------------------------------------------------------------------
const tr: Dict = {
  // Ortak
  'common.back': 'Geri',
  'common.cancel': 'Vazgeç',
  'common.save': 'Kaydet',
  'common.delete': 'Sil',
  'common.gotIt': 'Anladım',
  'common.searchCurrency': 'Para birimi ara (ör. EUR, Yen)',
  'common.item_one': '{n} kayıt',
  'common.item_other': '{n} kayıt',

  // Sekmeler
  'tabs.portfolio': 'Varlıklarım',
  'tabs.converter': 'Çevirici',
  'tabs.settings': 'Ayarlar',

  // Kilit
  'lock.title': 'MyNestVault kilitli',
  'lock.hint': 'Parmak izi veya ekran kilidinle aç.',
  'lock.unlock': 'Kilidi Aç',
  'lock.promptUnlock': "MyNestVault'un kilidini aç",
  'lock.promptEnable': 'Uygulama kilidini açmak için doğrula',
  'lock.promptDisable': 'Uygulama kilidini kapatmak için doğrula',
  'lock.requiredTitle': 'Cihaz kilidi gerekli',
  'lock.requiredMsg':
    'Uygulama kilidini kullanmak için önce telefonunun ayarlarından bir ekran kilidi (PIN, desen veya parmak izi) tanımla.',

  // Ayarlar
  'settings.title': 'Ayarlar',
  'settings.tagline': 'Altın ve Varlık Takibi',
  'settings.language': '🌐 Dil',
  'settings.appLock': '🔐 Uygulama Kilidi',
  'settings.appLockDesc':
    'Uygulamayı açmak için telefonunun parmak izini veya ekran kilidini iste.',
  'settings.privacy': '🔒 Tasarımı gereği gizli',
  'settings.privacyDesc':
    'Tüm varlıkların yalnızca bu cihazda saklanır. Hiçbir veri hiçbir yere gönderilmez.',
  'settings.prices': 'ℹ️ Fiyatlar hakkında',
  'settings.pricesDesc':
    'Fiyatlar küresel spot piyasa verilerine dayalı tahminlerdir ve gecikmeli olabilir. Kuyumcu, döviz bürosu veya bayi fiyatları işçilik, prim ve makas farkı nedeniyle değişebilir. MyNestVault yatırım tavsiyesi vermez.',

  // Portföy
  'portfolio.total': 'Toplam Değer',
  'portfolio.showTotalIn': 'Toplamı şu birimde göster',
  'portfolio.updated': 'Güncellendi {time}',
  'portfolio.notPriced': '{n} kayıt henüz fiyatlanmadı',
  'portfolio.emptyTitle': 'Kasan henüz boş',
  'portfolio.emptyDesc':
    'Nakit, altın, gümüş, kripto ve diğer değerlerini ekle; toplam değerini anlık gör — hepsi yalnızca bu cihazda saklanır.',
  'portfolio.addAsset': '＋ Varlık Ekle',

  // Varlık ekleme
  'add.title': 'Varlık Ekle',
  'add.question': 'Ne eklemek istersin?',
  'add.currency': 'Para birimi',
  'add.amount': 'Tutar *',
  'add.whoOwes': 'Kime verdin? *',
  'add.entryType': 'Giriş şekli',
  'add.modePiece': 'Kalıp (Çeyrek, Tam…)',
  'add.modeWeight': 'Ağırlık (gram + ayar)',
  'add.piece': 'Kalıp',
  'add.count': 'Adet *',
  'add.weightGram': 'Ağırlık (gram) *',
  'add.weightKg': 'Ağırlık (kg) *',
  'add.karat': 'Ayar',
  'add.cryptoAmount': 'Miktar ({symbol}) *',
  'add.assetName': 'Varlık adı *',
  'add.estValue': 'Tahmini değer *',
  'add.valueCurrency': 'Değer para birimi',
  'add.nameOptional': 'İsim (isteğe bağlı)',
  'add.purchaseTitle': 'Alış bilgisi (isteğe bağlı)',
  'add.purchaseHint':
    'Ne ödediğini gir, bu varlıktaki kâr/zararı görebilesin.',
  'add.purchaseValue': 'Alış değeri',
  'add.purchaseCurrency': 'Alış para birimi',
  'add.selectCurrency': 'Para Birimi Seç',
  'add.phPerson': 'ör. Ahmet',
  'add.phOther': 'ör. Arsa tapusu, Saat koleksiyonu',
  'add.phName': 'ör. Düğün altınları, Evdeki kasa',

  // Varlık listesi
  'list.otherAssets': 'Diğer Varlıklar',
  'list.empty': 'Bu grupta varlık yok.',
  'list.deleteTitle': 'Varlığı sil',
  'list.deleteMsg':
    '"{name}" kasandan kaldırılacak. Bu işlem geri alınamaz.',

  // Çevirici
  'conv.title': 'Çevirici',
  'conv.amount': 'Tutar',
  'conv.convertedTo': 'Çevrilen',
  'conv.lastUpdated': 'Son güncelleme: {time}',
  'conv.rates': 'Döviz Kurları',
  'conv.base': 'Baz: {code}',
  'conv.noMatch': '“{query}” ile eşleşen para birimi yok.',
  'conv.loading': 'Kurlar yükleniyor…',
  'conv.error': 'Kurlar yüklenemedi. Bağlantını kontrol edip tekrar dene.',
  'conv.retry': 'Tekrar dene',
};

const DICTS: Record<Lang, Dict> = { en, tr };

// ---------------------------------------------------------------------------
// Cihaz dili algılama (yerel modül gerektirmez)
// ---------------------------------------------------------------------------
function detectLang(): Lang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    if (locale.toLowerCase().indexOf('tr') === 0) return 'tr';
  } catch {
    // Intl yoksa İngilizce ile devam
  }
  return 'en';
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
export type Translate = (key: string, params?: Record<string, string | number>) => string;

interface LanguageValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translate;
}

const LanguageContext = createContext<LanguageValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

export function useT(): LanguageValue {
  return useContext(LanguageContext);
}

/** Varlık tipi / altın kalıbı gibi çift etiketli nesneler için yardımcı */
export function pickLabel(
  item: { labelEN: string; labelTR: string },
  lang: Lang
): string {
  return lang === 'tr' ? item.labelTR : item.labelEN;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'tr' || saved === 'en') setLangState(saved);
        else setLangState(detectLang());
      })
      .catch(() => setLangState(detectLang()))
      .finally(() => setReady(true));
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const t = useCallback<Translate>(
    (key, params) => {
      const dict = DICTS[lang];
      let text = dict[key] ?? en[key] ?? key;
      if (params) {
        for (const p of Object.keys(params)) {
          text = text.split(`{${p}}`).join(String(params[p]));
        }
      }
      return text;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  // Dil yüklenene kadar nötr ekran — metinlerin dil değiştirmesi görünmesin
  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: '#0F5856' }} />;
  }

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}
