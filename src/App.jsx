
import { SafeAreaView, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { HomeScreen } from './screens/HomeScreen'

function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <HomeScreen />
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