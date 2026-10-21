import { useContext, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme/tokens';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import ContractAnalysisScreen from '../screens/ContractAnalysisScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { TimelineScreen } from '../screens/TimelineScreen';
import { EvidenceUploadScreen } from '../screens/EvidenceUploadScreen';
import { NewCaseScreen } from '../screens/NewCaseScreen';
import { UploadScreen } from '../screens/UploadScreen';
import { ExpertScreen } from '../screens/ExpertScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ChatRoomScreen } from '../screens/ChatRoomScreen';
import { AuthContext } from '../context/AuthContext';
import { LoadingScreen } from '../components/LoadingScreen';
import ResponseGuideScreen from '../screens/ResponseGuideScreen';
import ReportPreviewScreen from '../screens/ReportPreviewScreen';
import ExpertQuestionScreen from '../screens/ExpertQuestionScreen';
import PreventionConsultScreen from '../screens/PreventionConsultScreen';
import PreContractChecklistScreen from '../screens/PreContractChecklistScreen';
import { GuardianScreen } from '../screens/GuardianScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { LegalDocumentScreen } from '../screens/LegalDocumentScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { HotBoardDetailScreen } from '../screens/HotBoardDetailScreen';
import {
  APP_ROUTES,
  AUTH_ROUTES,
  HOME_ROUTES,
  RECORD_ROUTES,
  EXPERT_ROUTES,
  CHAT_ROUTES,
  PREVENTION_ROUTES,
  GUARDIAN_ROUTES,
  ACCOUNT_ROUTES,
} from './routes';

// 같은 사건(caseId)의 증거 업로드/타임라인 화면은 스택에 하나만 두기 위한 id.
// React Navigation 7의 navigate는 이미 스택에 있는 화면으로 돌아가지 않고 새로 쌓기 때문에,
// 이게 없으면 "업로드 → 타임라인 → 업로드 → 타임라인…"처럼 같은 화면이 계속 중복으로 쌓였다.
// (caseId가 없는 빠른 기록 화면은 undefined → 기존처럼 동작)
const getCaseScreenId = ({ params }) => params?.caseId ?? undefined;

// 안드로이드(엣지투엣지)에서 하단 홈바/3버튼 시스템 바가 화면 맨 아래 버튼·입력창을 가리는 문제 해결용.
// 각 화면의 SafeAreaView는 edges에 'bottom'이 없어서 시스템 바 영역까지 내용이 내려가므로,
// 커스텀 하단 네비바(BottomNavBar)가 없는 화면은 여기서 하단 안전 영역만큼 한 번에 띄워준다.
// (BottomNavBar가 있는 화면·이미 bottom을 처리하는 화면은 감싸지 않는다 — 이중 여백 방지)
function withBottomInset(Screen, backgroundColor = C.surface) {
  function WithBottomInset(props) {
    const insets = useSafeAreaInsets();
    return (
      <View style={{ flex: 1, backgroundColor, paddingBottom: insets.bottom }}>
        <Screen {...props} />
      </View>
    );
  }
  WithBottomInset.displayName = `WithBottomInset(${Screen.displayName || Screen.name || 'Screen'})`;
  return WithBottomInset;
}

const EvidenceUploadInset = withBottomInset(EvidenceUploadScreen);
const TimelineInset = withBottomInset(TimelineScreen);
const UploadInset = withBottomInset(UploadScreen);
const ChatRoomInset = withBottomInset(ChatRoomScreen);
const ResponseGuideInset = withBottomInset(ResponseGuideScreen);
const ReportPreviewInset = withBottomInset(ReportPreviewScreen);
const ExpertQuestionInset = withBottomInset(ExpertQuestionScreen);
const HotBoardDetailInset = withBottomInset(HotBoardDetailScreen);
const PreContractChecklistInset = withBottomInset(PreContractChecklistScreen, C.sky050);
const GuardianInset = withBottomInset(GuardianScreen);
const AccountInset = withBottomInset(AccountScreen);
const LegalDocumentInset = withBottomInset(LegalDocumentScreen);
const NotificationsInset = withBottomInset(NotificationsScreen);

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
    <RecordsStack.Navigator screenOptions={{ headerShown: false }}>
      <RecordsStack.Screen
        name={RECORD_ROUTES.START}
        component={NewCaseScreen}
        options={{ headerShown: false }}
      />
      <RecordsStack.Screen
        name={RECORD_ROUTES.EVIDENCE_UPLOAD}
        component={EvidenceUploadInset}
        getId={getCaseScreenId}
        options={{ headerShown: false }}
      />
      <RecordsStack.Screen
        name={RECORD_ROUTES.EVIDENCE_TIMELINE}
        component={TimelineInset}
        getId={getCaseScreenId}
        options={{ headerShown: false }}
      />
      <RecordsStack.Screen
        name={RECORD_ROUTES.CONTRACT_ANALYSIS}
        component={ContractAnalysisScreen}
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
        component={ExpertScreen}
        options={{ headerShown: false }}
      />
    </ExpertsStack.Navigator>
  );
}

function ChatsNavigator() {
  return (
    <ChatsStack.Navigator screenOptions={screenOptions}>
      <ChatsStack.Screen
        name={CHAT_ROUTES.SOLIDARITY}
        component={ChatScreen}
        options={{ headerShown: false }}
      />
      <ChatsStack.Screen
        name={CHAT_ROUTES.ROOM}
        component={ChatRoomInset}
        options={{ headerShown: false }}
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

function AuthNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name={AUTH_ROUTES.LOGIN}>
        {({ navigation }) => (
          <LoginScreen onSwitchToSignup={() => navigation.replace(AUTH_ROUTES.SIGNUP)} />
        )}
      </RootStack.Screen>
      <RootStack.Screen name={AUTH_ROUTES.SIGNUP}>
        {({ navigation }) => (
          <SignupScreen onSwitchToLogin={() => navigation.replace(AUTH_ROUTES.LOGIN)} />
        )}
      </RootStack.Screen>
    </RootStack.Navigator>
  );
}

function AppStack() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="App">
      <RootStack.Screen name="App" component={MainTabsNavigator} />
      <RootStack.Screen name="UploadScreen" component={UploadInset} />
      <RootStack.Screen name="EvidenceUpload" component={EvidenceUploadInset} getId={getCaseScreenId} />
      <RootStack.Screen name="EvidenceTimeline" component={TimelineInset} getId={getCaseScreenId} />
      <RootStack.Screen name="RecordStart" component={NewCaseScreen} />
      <RootStack.Screen name="ResponseGuide" component={ResponseGuideInset} options={{ headerShown: false }} />
      <RootStack.Screen name="ExpertQuestion" component={ExpertQuestionInset} options={{ headerShown: false }} />
      <RootStack.Screen name={EXPERT_ROUTES.HOT_BOARD_DETAIL} component={HotBoardDetailInset} options={{ headerShown: false }} />
      <RootStack.Screen name={PREVENTION_ROUTES.CONSULT} component={PreventionConsultScreen} options={{ headerShown: false }} />
      <RootStack.Screen name={PREVENTION_ROUTES.CHECKLIST} component={PreContractChecklistInset} options={{ headerShown: false }} />
      <RootStack.Screen name={GUARDIAN_ROUTES.MANAGE} component={GuardianInset} options={{ headerShown: false }} />
      <RootStack.Screen name={ACCOUNT_ROUTES.ACCOUNT} component={AccountInset} options={{ headerShown: false }} />
      <RootStack.Screen name={ACCOUNT_ROUTES.LEGAL} component={LegalDocumentInset} options={{ headerShown: false }} />
      <RootStack.Screen name={ACCOUNT_ROUTES.NOTIFICATIONS} component={NotificationsInset} options={{ headerShown: false }} />
      <RootStack.Screen name={RECORD_ROUTES.REPORT_PREVIEW} component={ReportPreviewInset} options={{ headerShown: false }} />
    </RootStack.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading } = useContext(AuthContext);

  // 로그인 정보를 빨리 불러와도 로딩 애니메이션이 순간적으로 지나가지 않게 최소 1.6초는 보여준다
  const [minSplashDone, setMinSplashDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinSplashDone(true), 1600);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !minSplashDone) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {user ? <AppStack /> : <AuthNavigator />}
    </NavigationContainer>
  );
}