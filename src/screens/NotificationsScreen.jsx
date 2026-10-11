// src/screens/NotificationsScreen.jsx — 알림함 (홈 상단 종 아이콘)

import { useCallback, useContext, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { BackHeader } from '../components/BackHeader';
import { Icon } from '../components/Icon';
import { getNotifications, getNotificationsSeenAt, markNotificationsSeen } from '../services/notificationService';
import { APP_ROUTES, GUARDIAN_ROUTES } from '../navigation/routes';
import { C } from '../theme/tokens';

const TYPE_STYLE = {
  alert: { icon: 'alert-triangle', color: C.danger600, bg: C.danger100 },
  'guardian-request': { icon: 'users', color: C.brand600, bg: C.sky100 },
  'guardian-accepted': { icon: 'shield-check', color: C.safe600, bg: C.safe100 },
  answer: { icon: 'message', color: C.brand600, bg: C.sky100 },
};

function formatRelative(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  const d = new Date(ms);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function NotificationsScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState(null); // null = 불러오는 중
  const [seenAt, setSeenAt] = useState(0);

  // 화면에 들어올 때 목록을 불러오고, 이전에 본 시각 이후 것만 "새 알림"으로 표시한 뒤 모두 읽음 처리
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      (async () => {
        const [list, lastSeen] = await Promise.all([getNotifications(user.uid), getNotificationsSeenAt(user.uid)]);
        if (!active) return;
        setItems(list);
        setSeenAt(lastSeen);
        markNotificationsSeen(user.uid);
      })();
      return () => {
        active = false;
      };
    }, [user])
  );

  const open = (item) => {
    if (item.target === 'guardian') navigation.navigate(GUARDIAN_ROUTES.MANAGE);
    else if (item.target === 'board') navigation.navigate('App', { screen: APP_ROUTES.EXPERTS_STACK });
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <BackHeader title="알림" onBack={() => navigation.goBack()} />
      {items === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.brand600} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Icon name="check-circle" size={36} color={C.ink400} />
          <Text style={styles.emptyText}>새로운 알림이 없어요</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={{ gap: 10, paddingBottom: 40 }}>
          {items.map((item) => {
            const t = TYPE_STYLE[item.type] ?? TYPE_STYLE.answer;
            const isNew = item.time > seenAt;
            return (
              <TouchableOpacity key={item.id} style={[styles.row, isNew && styles.rowNew]} onPress={() => open(item)} activeOpacity={0.8}>
                <View style={[styles.iconWrap, { backgroundColor: t.bg }]}>
                  <Icon name={t.icon} size={18} color={t.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                  {item.body ? <Text style={styles.body} numberOfLines={2}>{item.body}</Text> : null}
                  <Text style={styles.time}>{formatRelative(item.time)}</Text>
                </View>
                {isNew && <View style={styles.newDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 13, color: C.ink400 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14,
  },
  rowNew: { backgroundColor: C.sky050, borderColor: C.sky100 },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13.5, fontWeight: '700', color: C.ink900, lineHeight: 19 },
  body: { fontSize: 12.5, color: C.ink500, marginTop: 3, lineHeight: 18 },
  time: { fontSize: 11, color: C.ink400, marginTop: 5 },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.danger600, marginTop: 6 },
});
