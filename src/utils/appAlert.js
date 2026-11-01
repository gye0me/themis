// src/utils/appAlert.js
//
// 앱과 웹에서 모두 뜨는 알림창. react-native-web의 Alert.alert는 아무 동작도 하지 않아서
// 웹에서는 저장 완료·오류 안내가 조용히 사라진다. 그래서 화면에서는 Alert.alert 대신 이 함수를 쓴다.
// 사용법은 Alert.alert와 같다: appAlert(제목, 내용, 버튼 배열)

import { Alert, Platform } from 'react-native';

export function appAlert(title, message, buttons) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = [title, message].filter(Boolean).join('\n\n');
  const cancel = buttons?.find((button) => button.style === 'cancel');
  const actions = (buttons ?? []).filter((button) => button !== cancel);

  if (!cancel && actions.length <= 1) {
    window.alert(text);
    actions[0]?.onPress?.();
    return;
  }

  // 브라우저 창에는 버튼을 두 개까지만 둘 수 있어, 선택지가 여럿이면 순서대로 묻는다
  for (const action of actions) {
    const question = actions.length > 1 ? `${text}\n\n"${action.text}"을(를) 선택할까요?` : text;
    if (window.confirm(question)) {
      action.onPress?.();
      return;
    }
  }
  cancel?.onPress?.();
}
