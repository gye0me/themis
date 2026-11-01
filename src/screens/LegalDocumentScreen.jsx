// src/screens/LegalDocumentScreen.jsx
// 이용약관 · 개인정보처리방침 · 위치기반서비스 이용약관 보기 (route.params.doc: 'terms' | 'privacy' | 'location')

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from '../components/BackHeader';
import { LEGAL_DOCUMENTS, LEGAL_VERSION } from '../services/legalDocuments';
import { C } from '../theme/tokens';

export function LegalDocumentScreen({ navigation, route }) {
  const legalDocument = LEGAL_DOCUMENTS[route?.params?.doc] ?? LEGAL_DOCUMENTS.terms;

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <BackHeader title={legalDocument.title} onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content} contentContainerStyle={{ gap: 18, paddingBottom: 40 }}>
        {legalDocument.sections.map((section) => (
          <View key={section.heading} style={{ gap: 6 }}>
            <Text style={styles.heading}>{section.heading}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
        <Text style={styles.version}>문서 버전 {LEGAL_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  heading: { fontSize: 14, fontWeight: '700', color: C.ink900 },
  body: { fontSize: 13, color: C.ink700, lineHeight: 21 },
  version: { fontSize: 11, color: C.ink400, textAlign: 'center' },
});
