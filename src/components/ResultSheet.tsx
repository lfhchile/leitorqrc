import { Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { parseContent } from '../parseContent';
import { formatLabel } from '../formats';

interface Props { data: string; type: string; onClose: () => void; }

export function ResultSheet({ data, type, onClose }: Props) {
  const parsed = parseContent(data, type);
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>{formatLabel(type)}</Text>
          <Text style={[styles.badge, styles.badgeAlt]}>{parsed.title}</Text>
        </View>
        <ScrollView style={{ maxHeight: 320 }}>
          {parsed.fields.map(f => (
            <View key={f.label} style={styles.field}>
              <Text style={styles.label}>{f.label}</Text>
              <Text style={styles.value} selectable>{f.value}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.actions}>
          {parsed.action && (
            <Btn primary label={parsed.action.label} onPress={() => Linking.openURL(parsed.action!.url).catch(() => {})} />
          )}
          <Btn label="Copiar" onPress={() => Clipboard.setStringAsync(data)} />
          <Btn label="Compartilhar" onPress={() => Share.share({ message: data })} />
          <Btn label="Fechar" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function Btn({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.btn, primary && styles.btnPrimary]}>
      <Text style={[styles.btnText, primary && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', padding: 20, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  badge: { backgroundColor: '#e8eefc', color: '#2952cc', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontWeight: '600', overflow: 'hidden' },
  badgeAlt: { backgroundColor: '#e7f6ec', color: '#1e7a3c' },
  field: { marginBottom: 10 },
  label: { fontSize: 12, color: '#666' },
  value: { fontSize: 16, color: '#111' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f0f0f0' },
  btnPrimary: { backgroundColor: '#2952cc' },
  btnText: { fontWeight: '600', color: '#222' },
});
