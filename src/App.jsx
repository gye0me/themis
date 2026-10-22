import { useEffect } from 'react'
import { AppState, Platform } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as NavigationBar from 'expo-navigation-bar'
import { AuthProvider } from './context/AuthContext'
import { AppNavigator } from './navigation/AppNavigator'

// 안드로이드 하단 시스템 바(홈바/3버튼)를 숨기고, 화면 아래에서 위로 스와이프하면 잠깐 나타났다가
// 다시 숨겨지게 한다. 앱을 다시 켤 때(포그라운드 복귀)도 숨김 상태를 복구한다.
function useHideAndroidNavBar() {
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined
    let timer = null
    const hide = () => NavigationBar.setVisibilityAsync('hidden').catch(() => {})
    hide()

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') hide()
    })
    // 스와이프로 바가 나타나면 잠시 뒤 다시 숨긴다
    const visibilitySub = NavigationBar.addVisibilityListener?.(({ visibility }) => {
      if (visibility === 'visible') {
        clearTimeout(timer)
        timer = setTimeout(hide, 2500)
      }
    })

    return () => {
      clearTimeout(timer)
      appStateSub.remove()
      visibilitySub?.remove?.()
    }
  }, [])
}

function App() {
  useHideAndroidNavBar()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

export default App
