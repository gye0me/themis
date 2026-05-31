import { SafeAreaView, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { EvidenceUploadScreen } from './screens/EvidenceUploadScreen'

function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <EvidenceUploadScreen />
      <StatusBar style="light" />
    </SafeAreaView>
  )
}

export default App

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
})