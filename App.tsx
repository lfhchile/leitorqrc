import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, scanFromURLAsync, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ALL_BARCODE_TYPES, formatLabel } from './src/formats';
import { addToHistory, clearHistory, loadHistory, removeFromHistory, type ScanRecord } from './src/history';
import { parseContent } from './src/parseContent';
import { ResultSheet } from './src/components/ResultSheet';

type Tab = 'scan' | 'history';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [tab, setTab] = useState<Tab>('scan');
  const [torch, setTorch] = useState(false);
  const [result, setResult] = useState<{ data: string; type: string } | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const locked = useRef(false);

  useEffect(() => { loadHistory().then(setHistory); }, []);

  const handleResult = useCallback(async (data: string, type: string) => {
    if (locked.current) return;
    locked.current = true;
    setResult({ data, type });
    setHistory(await addToHistory(data, type));
  }, []);

  const onScanned = useCallback((r: BarcodeScanningResult) => handleResult(r.data, r.type), [handleResult]);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled) return;
    try {
      const found = await scanFromURLAsync(res.assets[0].uri, ALL_BARCODE_TYPES);
      if (!found.length) return Alert.alert('Nenhum código encontrado', 'Tente outra imagem com o código mais nítido.');
      handleResult(found[0].data, found[0].type);
    } catch {
      Alert.alert('Erro', 'Não foi possível ler a imagem.');
    }
  };

  const closeResult = () => { setResult(null); setTimeout(() => { locked.current = false; }, 800); };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={tab === 'scan' ? 'light' : 'dark'} />
      {tab === 'scan' ? (
        !permission ? <View style={styles.center} /> :
        !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.msg}>Precisamos de acesso à câmera para ler códigos.</Text>
            <Pressable style={styles.primaryBtn} onPress={requestPermission}><Text style={styles.primaryBtnText}>Permitir câmera</Text></Pressable>
            <Pressable style={[styles.primaryBtn, styles.secondaryBtn]} onPress={pickImage}><Text style={styles.secondaryBtnText}>Ler de uma imagem</Text></Pressable>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: ALL_BARCODE_TYPES }}
              onBarcodeScanned={result ? undefined : onScanned}
            />
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.frame} />
              <Text style={styles.hint}>Aponte para um QR Code, Data Matrix, Aztec, PDF417 ou código de barras</Text>
            </View>
            <View style={styles.toolbar}>
              <ToolBtn label={torch ? 'Lanterna: on' : 'Lanterna: off'} onPress={() => setTorch(t => !t)} />
              <ToolBtn label="Galeria" onPress={pickImage} />
            </View>
          </View>
        )
      ) : (
        <HistoryList
          items={history}
          onOpen={r => setResult({ data: r.data, type: r.type })}
          onDelete={async id => setHistory(await removeFromHistory(id))}
          onClear={() => Alert.alert('Limpar histórico?', '', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Limpar', style: 'destructive', onPress: async () => { await clearHistory(); setHistory([]); } },
          ])}
        />
      )}

      <View style={styles.tabs}>
        <TabBtn label="Escanear" active={tab === 'scan'} onPress={() => setTab('scan')} />
        <TabBtn label={`Histórico (${history.length})`} active={tab === 'history'} onPress={() => setTab('history')} />
      </View>

      {result && <ResultSheet data={result.data} type={result.type} onClose={closeResult} />}
    </SafeAreaView>
  );
}

function HistoryList({ items, onOpen, onDelete, onClear }: {
  items: ScanRecord[]; onOpen: (r: ScanRecord) => void; onDelete: (id: string) => void; onClear: () => void;
}) {
  if (!items.length) return <View style={[styles.center, { backgroundColor: '#fff' }]}><Text style={styles.empty}>Nenhum código lido ainda.</Text></View>;
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.histHeader}>
        <Text style={styles.histTitle}>Histórico</Text>
        <Pressable onPress={onClear}><Text style={{ color: '#c62828', fontWeight: '600' }}>Limpar</Text></Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onOpen(item)} onLongPress={() => onDelete(item.id)}>
            <Text style={styles.rowMeta}>{formatLabel(item.type)} · {parseContent(item.data, item.type).title} · {new Date(item.date).toLocaleString('pt-BR')}</Text>
            <Text style={styles.rowData} numberOfLines={2}>{item.data}</Text>
          </Pressable>
        )}
        ListFooterComponent={<Text style={styles.footer}>Toque para abrir · segure para apagar</Text>}
      />
    </View>
  );
}

const ToolBtn = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable style={styles.toolBtn} onPress={onPress}><Text style={styles.toolBtnText}>{label}</Text></Pressable>
);
const TabBtn = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <Pressable style={styles.tab} onPress={onPress}><Text style={[styles.tabText, active && styles.tabActive]}>{label}</Text></Pressable>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  msg: { fontSize: 16, textAlign: 'center', marginBottom: 16 },
  primaryBtn: { backgroundColor: '#2952cc', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
  secondaryBtn: { backgroundColor: '#f0f0f0' },
  secondaryBtnText: { color: '#222', fontWeight: '600' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 260, height: 260, borderWidth: 3, borderColor: '#fff', borderRadius: 20 },
  hint: { color: '#fff', marginTop: 20, textAlign: 'center', paddingHorizontal: 32, textShadowColor: '#000', textShadowRadius: 4 },
  toolbar: { position: 'absolute', bottom: 24, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  toolBtn: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  toolBtnText: { color: '#fff', fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#ccc' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabText: { color: '#777', fontWeight: '600' },
  tabActive: { color: '#2952cc' },
  empty: { color: '#777' },
  histHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  histTitle: { fontSize: 22, fontWeight: '700' },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  rowMeta: { fontSize: 12, color: '#666', marginBottom: 2 },
  rowData: { fontSize: 15, color: '#111' },
  footer: { textAlign: 'center', color: '#999', padding: 16, fontSize: 12 },
});
