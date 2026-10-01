import { Text, View } from 'react-native';
import { THEMIS_ERD } from '../../services/themisSchema';
import styles from './RecordsScreen.styles';

export function RecordsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.badge}>FIRESTORE</Text>
        <Text style={styles.title}>ERD 반영 스키마</Text>
        <Text style={styles.subtitle}>관계형 ERD를 Firestore 컬렉션으로 옮긴 구조입니다. users/{'{uid}'} 기반 프로필을 중심으로 계약, 댓글, 채팅방을 연결합니다.</Text>
      </View>

      {THEMIS_ERD.map((collection) => (
        <View key={collection.key} style={styles.card}>
          <Text style={styles.sectionTitle}>{collection.title}</Text>
          <Text style={styles.description}>{collection.description}</Text>

          <View style={styles.fieldList}>
            {collection.fields.map((field) => (
              <Text key={field} style={styles.fieldItem}>• {field}</Text>
            ))}
          </View>

          {collection.notes.map((note) => (
            <Text key={note} style={styles.note}>{note}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}
