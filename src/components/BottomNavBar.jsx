// src/components/BottomNavBar.jsx
//
// 모든 화면 하단에 공통으로 쓰이는 커스텀 네비게이션 바.
// (MainTabsNavigator에서 기본 탭바는 숨기고, 각 화면이 이 컴포넌트로 직접 그린다 — 디자인 목업과
// 동일한 모양을 내기 위함. 자세한 배경은 AppNavigator.jsx의 tabScreenOptions 주석 참고.)

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { APP_ROUTES, CHAT_ROUTES } from '../navigation/routes';
import { C } from '../theme/tokens';

function NavIcon({ tab, color }) {
  const stroke = { stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (tab === 'records') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d="M12 20h9" {...stroke} />
        <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" {...stroke} />
      </Svg>
    );
  }
  if (tab === 'experts') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" {...stroke} />
        <Circle cx={10} cy={7} r={4} {...stroke} />
        <Path d="M22 21v-2a4 4 0 0 0-3-3.87" {...stroke} />
        <Path d="M15.5 3.13a4 4 0 0 1 0 7.75" {...stroke} />
      </Svg>
    );
  }
  if (tab === 'chats') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d="M21 11.5a8.4 8.4 0 0 1-8.9 8.4 8.8 8.8 0 0 1-3.6-.8L3 20l1-4.7A8.4 8.4 0 1 1 21 11.5Z" {...stroke} />
      </Svg>
    );
  }
  // home
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M3 11.5 12 4l9 7.5" {...stroke} />
      <Path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4h4v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" {...stroke} />
    </Svg>
  );
}

const TABS = [
  { key: 'records', label: '기록' },
  { key: 'experts', label: '전문가' },
  { key: 'chats', label: '채팅' },
  { key: 'home', label: '홈' },
];

/**
 * @param {'records'|'experts'|'chats'|'home'} active - 현재 활성 탭
 * @param {object} navigation - react-navigation의 navigation prop
 */
export function BottomNavBar({ active, navigation }) {
  const goTab = (key) => {
    if (key === active) return;
    if (key === 'records') navigation.navigate(APP_ROUTES.RECORDS_STACK);
    else if (key === 'experts') navigation.navigate(APP_ROUTES.EXPERTS_STACK);
    else if (key === 'chats') navigation.navigate(APP_ROUTES.CHATS_STACK, { screen: CHAT_ROUTES.SOLIDARITY });
    else if (key === 'home') navigation.navigate(APP_ROUTES.HOME_STACK);
  };

  return (
    <View style={styles.navbar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.navItem, isActive && styles.navItemActive]}
            activeOpacity={isActive ? 1 : 0.6}
            onPress={() => goTab(tab.key)}
          >
            <NavIcon tab={tab.key} color={isActive ? C.brand600 : C.ink400} />
            <Text style={isActive ? styles.navLabelActive : styles.navLabel}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingVertical: 10,
    paddingHorizontal: 8,
    paddingBottom: 18,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6, borderRadius: 14 },
  navItemActive: { backgroundColor: C.sky100 },
  navLabel: { fontSize: 10.5, color: C.ink400, fontWeight: '600' },
  navLabelActive: { fontSize: 10.5, color: C.brand600, fontWeight: '700' },
});
