<<<<<<< HEAD
=======
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { SafeAreaView, StyleSheet } from 'react-native'
import { HomeScreen } from './screens/HomeScreen'
import { UploadScreen } from './screens/UploadScreen'
import { TimelineScreen } from './screens/TimelineScreen'
import { NewCaseScreen } from './screens/NewCaseScreen'
>>>>>>> de5a76d5c96a66fa4b680c2a977d7cdbfa6188b9

import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from './context/AuthContext'
import { AppNavigator } from './navigation/AppNavigator'

function App() {
  return (
<<<<<<< HEAD
    <GestureHandlerRootView style={{ flex: 1, height: '100vh' }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
=======
    <SafeAreaView style={styles.container}>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="EvidenceUpload" component={UploadScreen} />
          <Stack.Screen name="EvidenceTimeline" component={TimelineScreen} />
          <Stack.Screen name="RecordStart" component={NewCaseScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaView>
>>>>>>> de5a76d5c96a66fa4b680c2a977d7cdbfa6188b9
  )
}

export default App