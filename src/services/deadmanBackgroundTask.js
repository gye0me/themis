// src/services/deadmanBackgroundTask.js
//
// 데드맨 스위치(위급 상황 자동 알림)의 "진짜 백그라운드" 감지 부분.
// 앱이 배경/최근앱 목록에 있는 동안에도(완전 종료는 예외) OS가 주기적으로
// 이 작업을 깨워서 30분 무응답 여부를 확인하고, 초과 시 알림을 띄운다.
//
// ⚠️ 한계 (정직하게 남겨둠):
// - expo-background-task는 "최소 15분 간격"을 OS에 요청할 뿐, 정확한 타이밍을 보장하지 않는다.
//   (iOS는 몇 시간씩 미뤄질 수 있고, 삼성/샤오미 등 일부 안드로이드 제조사는 배터리 최적화로
//   백그라운드 작업 자체를 더 공격적으로 죽이기도 한다 — 이건 OS/제조사 정책이라 앱 코드로 못 고친다.)
// - Expo Go에서는 이 모듈이 동작하지 않는다 — EAS 커스텀 개발 빌드(dev client)가 반드시 필요하다.
// - OS 정책상 백그라운드에서 SMS를 완전히 조용히 보낼 수는 없어서, 여기서는 "알림"까지만 띄우고
//   실제 문자 전송 화면은 사용자가 알림을 탭해 앱을 열었을 때(포그라운드) 마저 진행한다.

import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANDROID_CHANNEL_ID = 'deadman-alerts';

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: '위급 상황 자동 알림',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
}

export const DEADMAN_TASK_NAME = 'themis-deadman-check';
export const DEADMAN_TIMEOUT_MS = 30 * 60 * 1000;

const KEYS = {
  enabled: 'deadman:enabled',
  lastCheckIn: 'deadman:lastCheckIn',
  contactName: 'deadman:contactName',
  contactPhone: 'deadman:contactPhone',
  triggered: 'deadman:triggered', // 이미 알림을 보냈는지 — 중복 알림 방지
};

/**
 * HomeScreen의 상태(켜짐 여부/마지막 체크인/보호자 연락처)가 바뀔 때마다 호출해서
 * 백그라운드 태스크가 참조할 로컬 저장소를 동기화한다.
 * (백그라운드 태스크는 React state에 접근할 수 없어 AsyncStorage로 값을 넘겨받아야 한다.)
 */
export async function syncDeadmanLocalState({ enabled, lastCheckIn, contactName, contactPhone }) {
  await AsyncStorage.multiSet([
    [KEYS.enabled, enabled ? '1' : '0'],
    [KEYS.lastCheckIn, String(lastCheckIn ?? '')],
    [KEYS.contactName, contactName ?? ''],
    [KEYS.contactPhone, contactPhone ?? ''],
  ]);
  // 체크인이 갱신됐거나 다시 켰다면 "이미 알림 보냄" 상태를 초기화해서 다음 초과 시 다시 알리게 한다.
  if (enabled) {
    await AsyncStorage.setItem(KEYS.triggered, '0');
  }
}

export async function readDeadmanTriggeredFlag() {
  const value = await AsyncStorage.getItem(KEYS.triggered);
  return value === '1';
}

export async function clearDeadmanTriggeredFlag() {
  await AsyncStorage.setItem(KEYS.triggered, '0');
}

// 앱이 백그라운드에 있는 동안 OS가 이 함수를 주기적으로(최소 15분 간격, 비정확) 실행한다.
TaskManager.defineTask(DEADMAN_TASK_NAME, async () => {
  try {
    const entries = await AsyncStorage.multiGet([KEYS.enabled, KEYS.lastCheckIn, KEYS.triggered, KEYS.contactName]);
    const map = Object.fromEntries(entries);
    const enabled = map[KEYS.enabled] === '1';
    const lastCheckIn = Number(map[KEYS.lastCheckIn]) || null;
    const alreadyTriggered = map[KEYS.triggered] === '1';
    const contactName = map[KEYS.contactName] || '보호자';

    if (!enabled || !lastCheckIn || alreadyTriggered) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    if (Date.now() - lastCheckIn >= DEADMAN_TIMEOUT_MS) {
      await AsyncStorage.setItem(KEYS.triggered, '1');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Themis 무응답 감지됨',
          body: `30분간 체크인이 없었어요. 탭해서 ${contactName}에게 위치와 함께 알림을 보내세요.`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority?.MAX,
          data: { type: 'deadman-alert' },
        },
        trigger: Platform.OS === 'android' ? { type: 'channel', channelId: ANDROID_CHANNEL_ID } : null,
      });
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('데드맨 백그라운드 체크 오류:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerDeadmanBackgroundTask() {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
    console.warn('이 기기/환경에서는 백그라운드 작업을 사용할 수 없습니다 (Expo Go일 가능성).');
    return false;
  }
  await ensureAndroidChannel();
  await BackgroundTask.registerTaskAsync(DEADMAN_TASK_NAME, { minimumInterval: 15 });
  return true;
}

export async function unregisterDeadmanBackgroundTask() {
  const registered = await TaskManager.isTaskRegisteredAsync(DEADMAN_TASK_NAME).catch(() => false);
  if (registered) {
    await BackgroundTask.unregisterTaskAsync(DEADMAN_TASK_NAME).catch((err) =>
      console.warn('백그라운드 작업 해제 실패:', err.message)
    );
  }
}
