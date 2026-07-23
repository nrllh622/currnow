// ConfirmDialog.tsx
// MyNestVault — Ortak onay/bilgi diyaloğu
// Android'in yerleşik Alert penceresi stillenemediği için (küçük, soluk OK
// butonu) tüm onay ve uyarılar bu bileşenle gösterilir.
//
// Kullanım:
//   Tek butonlu bilgi  : cancelLabel verilmez
//   Onay               : cancelLabel verilir
//   Yıkıcı işlem (sil) : destructive={true} → buton kırmızı

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const dismiss = onCancel ?? onConfirm;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.scrim}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.buttons}>
            {cancelLabel ? (
              <Pressable
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.btn,
                  styles.cancelBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cancelText}>{cancelLabel}</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.btn,
                destructive ? styles.destructiveBtn : styles.confirmBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const TEAL = '#16A382';
const INK = '#122E30';
const GREY = '#78888A';

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(10, 30, 28, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    elevation: 8,
  },
  title: { fontSize: 19, fontWeight: '800', color: INK },
  message: { fontSize: 14, color: GREY, marginTop: 10, lineHeight: 21 },

  buttons: { flexDirection: 'row', gap: 10, marginTop: 22 },
  btn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  cancelBtn: {
    backgroundColor: '#F1F5F4',
    borderWidth: 1,
    borderColor: '#E2E9E8',
  },
  confirmBtn: { backgroundColor: TEAL },
  destructiveBtn: { backgroundColor: '#DC2626' },
  cancelText: { fontSize: 16, fontWeight: '800', color: GREY },
  confirmText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
