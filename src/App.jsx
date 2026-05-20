
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onAuthChange } from './services/firebaseService'
import { HomeScreen } from './screens/HomeScreen'
import { LoginScreen } from './screens/LoginScreen'
import { SignupScreen } from './screens/SignupScreen'
import './styles/variables.css'
import './index.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Firebase 인증 상태 감지
  useEffect(() => {
    const unsubscribe = onAuthChange((currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>로딩 중...</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* 로그인된 사용자만 접근 가능 */}
        <Route 
          path="/" 
          element={user ? <HomeScreen /> : <Navigate to="/login" />} 
        />
        
        {/* 로그인하지 않은 사용자만 접근 가능 */}
        <Route 
          path="/login" 
          element={!user ? <LoginScreen /> : <Navigate to="/" />} 
        />
        <Route 
          path="/signup" 
          element={!user ? <SignupScreen /> : <Navigate to="/" />} 
        />
        
        {/* 잘못된 경로 처리 */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App