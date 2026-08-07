// inAppUpdate.ts
// MyNestVault — Play Store içi güncelleme kontrolü (Android)
//
// Eski CurrNow kullanıcılarının yeni sürüme geçişini hızlandırmak için,
// uygulama açılışında Play'de daha yeni bir sürüm varsa "flexible" güncelleme
// istemi gösterir (kullanıcı reddedebilir, arka planda iner).
//
// ÖNEMLİ:
//  - Yalnızca GERÇEK Play Store'dan inen sürümde çalışır (dev/Expo Go'da değil).
//  - Native modül (expo-in-app-updates) gerektirir; paket yoksa ya da hata
//    olursa sessizce hiçbir şey yapmaz — uygulamayı asla çökertmez.
//  - iOS'ta Play Core yoktur; bu modül Android'e özeldir.

import { Platform } from 'react-native';

export async function checkForUpdate(): Promise<void> {
  // Geliştirme modunda çalıştırma (dev'de zaten Metro'dan güncel kod gelir)
  if (__DEV__ || Platform.OS !== 'android') return;

  try {
    // Dinamik import: paket kurulu değilse import başarısız olur, catch yakalar
    const InAppUpdates = await import('expo-in-app-updates');
    // Argümansız çağrı: Play, önceliğe göre flexible/immediate seçer,
    // güncelleme varsa akışı kendisi başlatır.
    await InAppUpdates.checkAndStartUpdate();
  } catch {
    // Paket yok / cihaz desteklemiyor / Play dışı kaynak → sessizce geç
  }
}
