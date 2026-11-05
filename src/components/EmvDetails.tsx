import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EmvField, EmvResult } from '../emv';

/** Painel de conformidade EMV: status, problemas encontrados e árvore de objetos. */
export function EmvDetails({ emv }: { emv: EmvResult }) {
  const [showTree, setShowTree] = useState(false);
  const errors = emv.issues.filter(i => i.level === 'error');
  const warnings = emv.issues.filter(i => i.level === 'warning');

  return (
    <View style={styles.box}>
      <View style={[styles.status, emv.valid ? styles.ok : styles.bad]}>
        <Text style={[styles.statusText, { color: emv.valid ? '#1e7a3c' : '#b3261e' }]}>
          {emv.valid ? '✓ Conforme EMV QRCPS-MPM v1.1' : `✗ ${errors.length} erro(s) de conformidade EMV`}
        </Text>
        <Text style={styles.crc}>
          CRC {emv.crc.found ?? '—'} {emv.crc.ok ? '(válido)' : emv.crc.expected ? `(esperado ${emv.crc.expected})` : ''}
        </Text>
      </View>

      {[...errors, ...warnings].map((i, idx) => (
        <Text key={idx} style={[styles.issue, i.level === 'error' ? styles.issueErr : styles.issueWarn]}>
          {i.level === 'error' ? 'Erro' : 'Aviso'} · ID {i.path || 'payload'} · §{i.rule}: {i.message}
        </Text>
      ))}

      <Pressable onPress={() => setShowTree(v => !v)} style={styles.toggle}>
        <Text style={styles.toggleText}>{showTree ? '▾' : '▸'} Estrutura completa ({emv.fields.length} objetos)</Text>
      </Pressable>
      {showTree && emv.fields.map(f => <FieldRow key={f.path} field={f} depth={0} />)}
    </View>
  );
}

function FieldRow({ field, depth }: { field: EmvField; depth: number }) {
  return (
    <View style={{ marginLeft: depth * 14 }}>
      <View style={styles.row}>
        <Text style={styles.id}>{field.path}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{field.name}</Text>
          {!field.children && <Text style={styles.value} selectable>{field.value}</Text>}
          {field.display && <Text style={styles.display}>{field.display}</Text>}
        </View>
      </View>
      {field.children?.map(c => <FieldRow key={c.path} field={c} depth={depth + 1} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 8 },
  status: { padding: 10, borderRadius: 10, marginBottom: 8 },
  ok: { backgroundColor: '#e7f6ec' },
  bad: { backgroundColor: '#fdecea' },
  statusText: { fontWeight: '700' },
  crc: { fontSize: 12, color: '#555', marginTop: 2, fontFamily: 'monospace' },
  issue: { fontSize: 13, marginBottom: 6, paddingLeft: 8, borderLeftWidth: 3 },
  issueErr: { borderColor: '#b3261e', color: '#5c1a14' },
  issueWarn: { borderColor: '#c77700', color: '#5a3c00' },
  toggle: { paddingVertical: 8 },
  toggleText: { fontWeight: '600', color: '#2952cc' },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  id: { fontFamily: 'monospace', color: '#888', width: 48 },
  name: { fontSize: 12, color: '#666' },
  value: { fontSize: 14, color: '#111' },
  display: { fontSize: 12, color: '#2952cc' },
});
