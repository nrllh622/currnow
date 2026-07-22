// AssetListScreen.tsx
// MyNestVault — Varlık listesi (tam ekran kaplama)
// Portföyde bir tip kartına dokununca o tipteki varlıklar listelenir;
// her satırda açıklama + güncel değer + silme butonu bulunur.

import React from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAssetType, getGoldPiece } from './assetTypes';
import type { Asset } from './portfolioStore';
import type { AssetValuation } from './valuation';

interface Props {
  visible: boolean;
  title: string;
  items: AssetValuation[];
  displayCurrency: string;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// Thousands separators without relying on Intl (Hermes-safe on Android).
function formatNumber(value: number): string {
  if (!isFinite(value)) return '—';
  const decimals = value !== 0 && Math.abs(value) < 1 ? 4 : 2;
  const fixed = value.toFixed(decimals);
  const parts = fixed.split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? intPart + '.' + parts[1] : intPart;
}

// Varlığın içerik özeti: "500 USD", "2 × Çeyrek Altın", "12 g", "0.5 BTC"...
function describeAsset(asset: Asset): string {
  const type = getAssetType(asset.typeId);
  if (!type) return '';
  switch (type.valuationClass) {
    case 'FX': {
      const base = `${asset.amount ?? 0} ${asset.currencyCode ?? ''}`;
      return asset.personName ? `${asset.personName} · ${base}` : base;
    }
    case 'METAL': {
      if (asset.pieceId && asset.count) {
        const piece = getGoldPiece(asset.pieceId);
        return `${asset.count} × ${piece ? piece.labelTR : asset.pieceId}`;
      }
      if (asset.weightGrams) {
        if (type.id === 'copper') return `${asset.weightGrams / 1000} kg`;
        return `${asset.weightGrams} g`;
      }
      return '';
    }
    case 'CRYPTO':
      return `${asset.units ?? 0} ${type.symbol ?? ''}`;
    case 'MANUAL':
      return `${asset.manualValue ?? 0} ${asset.manualCurrency ?? ''}`;
    default:
      return '';
  }
}

export default function AssetListScreen({
  visible,
  title,
  items,
  displayCurrency,
  onDelete,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const confirmDelete = (asset: Asset) => {
    const name = asset.label ?? describeAsset(asset);
    Alert.alert(
      'Delete asset',
      `"${name}" will be removed from your vault. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(asset.id) },
      ]
    );
  };

  return (
    <View style={[styles.overlay, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.topBarAction}>‹ Back</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>{title}</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.asset.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No assets in this group.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.asset.label ?? describeAsset(item.asset)}
              </Text>
              {item.asset.label ? (
                <Text style={styles.rowSub} numberOfLines={1}>
                  {describeAsset(item.asset)}
                </Text>
              ) : null}
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>
                {item.valueDisplay !== null
                  ? `${formatNumber(item.valueDisplay)} ${displayCurrency}`
                  : '—'}
              </Text>
              {item.gainDisplay !== null ? (
                <Text
                  style={[
                    styles.rowGain,
                    item.gainDisplay >= 0 ? styles.gainUp : styles.gainDown,
                  ]}
                >
                  {item.gainDisplay >= 0 ? '▲' : '▼'}{' '}
                  {formatNumber(Math.abs(item.gainDisplay))}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => confirmDelete(item.asset)}
              hitSlop={8}
              style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
            >
              <Text style={styles.deleteText}>🗑</Text>
            </Pressable>
          </View>
        )}
      />
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
    zIndex: 15,
  },
  pressed: { opacity: 0.6 },

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

  listContent: { paddingBottom: 30 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#ECF1F0',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: INK },
  rowSub: { fontSize: 12, color: GREY, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowValue: {
    fontSize: 15,
    fontWeight: '800',
    color: INK,
    fontVariant: ['tabular-nums'],
  },
  rowGain: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  gainUp: { color: '#0E9F6E' },
  gainDown: { color: '#DC2626' },

  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { fontSize: 16 },

  emptyBox: { padding: 30, alignItems: 'center' },
  emptyText: { color: GREY, fontSize: 14 },
});
