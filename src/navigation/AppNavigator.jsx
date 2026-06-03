import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { NavigationPlaceholderScreen } from '../screens/shared/NavigationPlaceholderScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { TimelineScreen } from '../screens/TimelineScreen';
import { EvidenceUploadScreen } from '../screens/EvidenceUploadScreen';
import { NewCaseScreen } from '../screens/NewCaseScreen';
import { UploadScreen } from '../screens/UploadScreen';
import {
  APP_ROUTES,
  AUTH_ROUTES,
  HOME_ROUTES,
  RECORD_ROUTES,
  EXPERT_ROUTES,
  CHAT_ROUTES,
} from './routes';

const RootStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const RecordsStack = createNativeStackNavigator();
const ExpertsStack = createNativeStackNavigator();
const ChatsStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function screenOptions() {
  return {
    headerStyle: {
      backgroundColor: '#0d1627',
    },
    headerTintColor: '#ffffff',
    headerTitleStyle: {
      fontWeight: '700',
    },
    contentStyle: {
      backgroundColor: '#0b1220',
    },
  };
}

function tabScreenOptions({ route }) {
  const labels = {
    [APP_ROUTES.RECORDS_STACK]: '기록',
    [APP_ROUTES.EXPERTS_STACK]: '전문가',
    [APP_ROUTES.CHATS_STACK]: '채팅',
    [APP_ROUTES.HOME_STACK]: '홈',
  };

  return {
    headerShown: false,
    tabBarActiveTintColor: '#ffffff',
    tabBarInactiveTintColor: '#8d9ab5',
    tabBarStyle: {
      display: 'none', // 커스텀 네비바를 사용하므로 기본 탭은 숨김 처리
      backgroundColor: '#0d1627',
      borderTopColor: '#1d2a42',
    },
    tabBarLabel: ({ color }) => (
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{labels[route.name] || route.name}</Text>
    ),
  };
}

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={screenOptions}>
      <HomeStack.Screen
        name={HOME_ROUTES.HOME}
        component={HomeScreen}
        options={{ headerShown: false }}
      />
    </HomeStack.Navigator>
  );
}

function RecordsNavigator() {
  return (
    <RecordsStack.Navigator screenOptions={screenOptions}>
      <RecordsStack.Screen
        name={RECORD_ROUTES.START}
        component={NewCaseScreen}
        options={{ headerShown: false }}
      />
      <RecordsStack.Screen
        name={RECORD_ROUTES.CONTRACT_ANALYSIS}
        component={NavigationPlaceholderScreen}
        options={{ title: '계약서 분석' }}
        initialParams={{
          title: '계약서 분석',
          subtitle: 'Records > Analysis',
          description: '계약서 내용을 분석하는 화면입니다.',
        }}
      />
      <RecordsStack.Screen
        name={RECORD_ROUTES.EVIDENCE_UPLOAD}
        component={EvidenceUploadScreen}
        options={{ headerShown: false }}
      />
      <RecordsStack.Screen
        name={RECORD_ROUTES.EVIDENCE_TIMELINE}
        component={TimelineScreen}
        options={{ headerShown: false }}
      />
    </RecordsStack.Navigator>
  );
}

function ExpertsNavigator() {
  return (
    <ExpertsStack.Navigator screenOptions={screenOptions}>
      <ExpertsStack.Screen
        name={EXPERT_ROUTES.GUIDE}
        component={NavigationPlaceholderScreen}
        options={{ title: '대응가이드' }}
        initialParams={{
          title: '대응가이드',
          subtitle: 'Experts',
          description: '대응 절차와 가이드를 확인하는 화면입니다.',
        }}
      />
    </ExpertsStack.Navigator>
  );
}

function ChatsNavigator() {
  return (
    <ChatsStack.Navigator screenOptions={screenOptions}>
      <ChatsStack.Screen
        name={CHAT_ROUTES.SOLIDARITY}
        component={NavigationPlaceholderScreen}
        options={{ title: '연대 (채팅)' }}
        initialParams={{
          title: '연대 (채팅)',
          subtitle: 'Chats',
          description: '연대용 채팅 시작 화면입니다.',
        }}
      />
    </ChatsStack.Navigator>
  );
}

function MainTabsNavigator() {
  return (
    <Tabs.Navigator screenOptions={tabScreenOptions} initialRouteName={APP_ROUTES.HOME_STACK}>
      <Tabs.Screen name={APP_ROUTES.RECORDS_STACK} component={RecordsNavigator} options={{ headerShown: false }} />
      <Tabs.Screen name={APP_ROUTES.EXPERTS_STACK} component={ExpertsNavigator} options={{ headerShown: false }} />
      <Tabs.Screen name={APP_ROUTES.CHATS_STACK} component={ChatsNavigator} options={{ headerShown: false }} />
      <Tabs.Screen name={APP_ROUTES.HOME_STACK} component={HomeNavigator} options={{ headerShown: false }} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="App">
        <RootStack.Screen name="App" component={MainTabsNavigator} />
        {/* 홈 화면 등에서 사용하는 하드코딩 된 문자열 네비게이션과 완벽히 매칭하기 위해 추가 */}
        <RootStack.Screen name="UploadScreen" component={UploadScreen} />
        <RootStack.Screen name="EvidenceUpload" component={EvidenceUploadScreen} />
        <RootStack.Screen name="EvidenceTimeline" component={TimelineScreen} />
        <RootStack.Screen name="RecordStart" component={NewCaseScreen} />
        <RootStack.Screen
          name={AUTH_ROUTES.LOGIN}
          options={{ presentation: 'modal' }}
        >
          {({ navigation }) => (
            <LoginScreen onSwitchToSignup={() => navigation.replace(AUTH_ROUTES.SIGNUP)} />
          )}
        </RootStack.Screen>
        <RootStack.Screen
          name={AUTH_ROUTES.SIGNUP}
          options={{ presentation: 'modal' }}
        >
          {({ navigation }) => (
            <SignupScreen onSwitchToLogin={() => navigation.replace(AUTH_ROUTES.LOGIN)} />
          )}
        </RootStack.Screen>
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
