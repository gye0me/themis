import { useContext } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { AuthContext, AuthProvider } from './context/AuthContext'
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen } from './screens/LoginScreen';
import { EvidenceUploadScreen } from './screens/EvidenceUploadScreen';
import { UploadScreen } from './screens/UploadScreen';

const Stack = createStackNavigator();

function RootNavigator() {
  const { user } = useContext(AuthContext);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="App" component={EvidenceUploadScreen} />
          <Stack.Screen name="Upload" component={UploadScreen} />
        </>
      ) : (
        // 생성된 LoginScreen을 연결하여 인증 흐름을 복구합니다.
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

function App() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style="auto" />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </AuthProvider>
  )
}

export default App
