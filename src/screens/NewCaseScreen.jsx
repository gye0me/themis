import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export function NewCaseScreen({ navigation }) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.appbar}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('App'); // 실제 최상위 네비게이터 이름인 'App'으로 이동
            }
          }}
        >
          <Text style={styles.back}>‹ 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>새 기록 시작하기</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.placeholder}>사건 생성 화면 준비 중</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F1F5F9' },
  appbar: { backgroundColor: '#1E3A5F', padding: 16, paddingTop: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { paddingVertical: 8, paddingRight: 16 }, // 터치하기 쉽도록 영역 확대
  back: { color: '#7B9EC5', fontSize: 16 },
  title: { color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { color: '#94A3B8', fontSize: 14 },
});