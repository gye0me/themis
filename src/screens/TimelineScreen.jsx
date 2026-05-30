import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export function TimelineScreen({ navigation }) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.appbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>증거 타임라인</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.placeholder}>증거 타임라인 화면 준비 중</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F1F5F9' },
  appbar: { backgroundColor: '#1E3A5F', padding: 16, paddingTop: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { color: '#7B9EC5', fontSize: 16 },
  title: { color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { color: '#94A3B8', fontSize: 14 },
});