import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { NavigationPlaceholderScreen } from '../screens/shared/NavigationPlaceholderScreen';
import {
  APP_ROUTES,
  AUTH_ROUTES,
  HOME_ROUTES,
  CONTRACT_ROUTES,
  COMMUNITY_ROUTES,
  CHAT_ROUTES,
  SETTINGS_ROUTES,
} from './routes';

const RootStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const ContractsStack = createNativeStackNavigator();
const CommunityStack = createNativeStackNavigator();
const ChatsStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();
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
    [APP_ROUTES.HOME_STACK]: '홈',
    [APP_ROUTES.CONTRACTS_STACK]: '계약',
    [APP_ROUTES.COMMUNITY_STACK]: '커뮤니티',
    [APP_ROUTES.CHATS_STACK]: '채팅',
    [APP_ROUTES.SETTINGS_STACK]: '설정',
  };

  return {
    headerShown: false,
    tabBarActiveTintColor: '#ffffff',
    tabBarInactiveTintColor: '#8d9ab5',
    tabBarStyle: {
      backgroundColor: '#0d1627',
      borderTopColor: '#1d2a42',
    },
    tabBarLabel: ({ color }) => (
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{labels[route.name] || route.name}</Text>
    ),
  };
}

function SettingsHomeScreen(props) {
  const { user } = useAuth();

  const isLoggedIn = Boolean(user);
  const actions = isLoggedIn
    ? []
    : [
        { label: '로그인', target: AUTH_ROUTES.LOGIN, variant: 'primary' },
        { label: '회원가입', target: AUTH_ROUTES.SIGNUP, variant: 'secondary' },
      ];

  return (
    <NavigationPlaceholderScreen
      {...props}
      route={{
        ...props.route,
        params: {
          ...props.route?.params,
          title: '설정',
          subtitle: 'Settings',
          description: isLoggedIn
            ? '현재 로그인된 상태입니다. 계정/보안 설정을 여기서 관리할 수 있습니다.'
            : '메인 기능은 로그인 없이 사용할 수 있습니다. 로그인은 필요할 때 직접 선택하세요.',
          actions,
        },
      }}
    />
  );
}

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={screenOptions}>
      <HomeStack.Screen
        name={HOME_ROUTES.DASHBOARD}
        component={NavigationPlaceholderScreen}
        options={{ title: '대시보드' }}
        initialParams={{
          title: '대시보드',
          subtitle: 'Home',
          description: '사용자 요약, 최근 사건, 빠른 진입점을 표시하는 시작 화면입니다.',
        }}
      />
      <HomeStack.Screen
        name={HOME_ROUTES.CONTRACT_DETAIL}
        component={NavigationPlaceholderScreen}
        options={{ title: '계약 상세' }}
        initialParams={{
          title: '계약 상세',
          subtitle: 'Home > Contract',
          description: '홈에서 진입하는 계약 상세 화면입니다.',
        }}
      />
      <HomeStack.Screen
        name={HOME_ROUTES.CHATROOM_PREVIEW}
        component={NavigationPlaceholderScreen}
        options={{ title: '채팅 미리보기' }}
        initialParams={{
          title: '채팅 미리보기',
          subtitle: 'Home > Chatroom',
          description: '홈에서 바로 들어가는 상담/채팅 진입 화면입니다.',
        }}
      />
    </HomeStack.Navigator>
  );
}

function ContractsNavigator() {
  return (
    <ContractsStack.Navigator screenOptions={screenOptions}>
      <ContractsStack.Screen
        name={CONTRACT_ROUTES.LIST}
        component={NavigationPlaceholderScreen}
        options={{ title: '계약 목록' }}
        initialParams={{
          title: '계약 목록',
          subtitle: 'Contracts',
          description: 'ERD의 contracts, contract_clauses 컬렉션을 다루는 목록 화면입니다.',
        }}
      />
      <ContractsStack.Screen
        name={CONTRACT_ROUTES.DETAIL}
        component={NavigationPlaceholderScreen}
        options={{ title: '계약 상세' }}
        initialParams={{
          title: '계약 상세',
          subtitle: 'Contracts > Detail',
          description: 'OCR, 리스크 점수, 원본 이미지, 조항 분석 결과를 보여주는 화면입니다.',
        }}
      />
      <ContractsStack.Screen
        name={CONTRACT_ROUTES.CLAUSE_DETAIL}
        component={NavigationPlaceholderScreen}
        options={{ title: '조항 상세' }}
        initialParams={{
          title: '조항 상세',
          subtitle: 'Contracts > Clause',
          description: '개별 조항의 위험도와 설명을 보여주는 화면입니다.',
        }}
      />
      <ContractsStack.Screen
        name={CONTRACT_ROUTES.UPLOAD}
        component={NavigationPlaceholderScreen}
        options={{ title: '계약 업로드' }}
        initialParams={{
          title: '계약 업로드',
          subtitle: 'Contracts > Upload',
          description: '새 계약 이미지를 업로드하고 분석하는 시작 화면입니다.',
        }}
      />
    </ContractsStack.Navigator>
  );
}

function CommunityNavigator() {
  return (
    <CommunityStack.Navigator screenOptions={screenOptions}>
      <CommunityStack.Screen
        name={COMMUNITY_ROUTES.FEED}
        component={NavigationPlaceholderScreen}
        options={{ title: '커뮤니티' }}
        initialParams={{
          title: '커뮤니티 피드',
          subtitle: 'Community',
          description: 'community_comments를 포함한 게시글/댓글 영역의 시작 화면입니다.',
        }}
      />
      <CommunityStack.Screen
        name={COMMUNITY_ROUTES.POST_DETAIL}
        component={NavigationPlaceholderScreen}
        options={{ title: '게시글 상세' }}
        initialParams={{
          title: '게시글 상세',
          subtitle: 'Community > Post',
          description: '게시글 본문과 댓글 흐름을 보여주는 화면입니다.',
        }}
      />
      <CommunityStack.Screen
        name={COMMUNITY_ROUTES.COMMENT_THREAD}
        component={NavigationPlaceholderScreen}
        options={{ title: '댓글 스레드' }}
        initialParams={{
          title: '댓글 스레드',
          subtitle: 'Community > Thread',
          description: '전문가 답변 여부를 구분해 표시하는 댓글 상세 영역입니다.',
        }}
      />
    </CommunityStack.Navigator>
  );
}

function ChatsNavigator() {
  return (
    <ChatsStack.Navigator screenOptions={screenOptions}>
      <ChatsStack.Screen
        name={CHAT_ROUTES.LIST}
        component={NavigationPlaceholderScreen}
        options={{ title: '채팅방' }}
        initialParams={{
          title: '채팅방 목록',
          subtitle: 'Chats',
          description: 'chatrooms, chatroom_members 컬렉션을 다루는 목록 화면입니다.',
        }}
      />
      <ChatsStack.Screen
        name={CHAT_ROUTES.DETAIL}
        component={NavigationPlaceholderScreen}
        options={{ title: '채팅방 상세' }}
        initialParams={{
          title: '채팅방 상세',
          subtitle: 'Chats > Room',
          description: '참여자 정보와 메시지 흐름을 보여주는 화면입니다.',
        }}
      />
      <ChatsStack.Screen
        name={CHAT_ROUTES.MEMBER_DETAIL}
        component={NavigationPlaceholderScreen}
        options={{ title: '멤버 상세' }}
        initialParams={{
          title: '멤버 상세',
          subtitle: 'Chats > Member',
          description: '채팅방 멤버 역할과 참여 정보를 보여주는 화면입니다.',
        }}
      />
    </ChatsStack.Navigator>
  );
}

function SettingsNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={screenOptions}>
      <SettingsStack.Screen
        name={SETTINGS_ROUTES.MAIN}
        component={SettingsHomeScreen}
        options={{ title: '설정' }}
      />
      <SettingsStack.Screen
        name={SETTINGS_ROUTES.PROFILE_EDIT}
        component={NavigationPlaceholderScreen}
        options={{ title: '프로필 편집' }}
        initialParams={{
          title: '프로필 편집',
          subtitle: 'Settings > Profile',
          description: 'users 문서의 닉네임, 전화번호, 프로필 이미지를 수정하는 화면입니다.',
        }}
      />
      <SettingsStack.Screen
        name={SETTINGS_ROUTES.SECURITY}
        component={NavigationPlaceholderScreen}
        options={{ title: '보안 설정' }}
        initialParams={{
          title: '보안 설정',
          subtitle: 'Settings > Security',
          description: '인증, 비밀번호, 계정 보안 관련 옵션을 다루는 화면입니다.',
        }}
      />
      <SettingsStack.Screen
        name={SETTINGS_ROUTES.NOTIFICATIONS}
        component={NavigationPlaceholderScreen}
        options={{ title: '알림 설정' }}
        initialParams={{
          title: '알림 설정',
          subtitle: 'Settings > Notifications',
          description: '앱 푸시, 커뮤니티 알림, 상담 알림을 제어하는 화면입니다.',
        }}
      />
    </SettingsStack.Navigator>
  );
}

function MainTabsNavigator() {
  return (
    <Tabs.Navigator screenOptions={tabScreenOptions}>
      <Tabs.Screen name={APP_ROUTES.HOME_STACK} component={HomeNavigator} options={{ headerShown: false }} />
      <Tabs.Screen name={APP_ROUTES.CONTRACTS_STACK} component={ContractsNavigator} options={{ headerShown: false }} />
      <Tabs.Screen name={APP_ROUTES.COMMUNITY_STACK} component={CommunityNavigator} options={{ headerShown: false }} />
      <Tabs.Screen name={APP_ROUTES.CHATS_STACK} component={ChatsNavigator} options={{ headerShown: false }} />
      <Tabs.Screen name={APP_ROUTES.SETTINGS_STACK} component={SettingsNavigator} options={{ headerShown: false }} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="App">
        <RootStack.Screen name="App" component={MainTabsNavigator} />
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
