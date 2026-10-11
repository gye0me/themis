// 로그인(복원)이 끝난 뒤에 Realtime Database 구독을 붙이는 onValue 래퍼.
// 앱 시작 직후 auth.currentUser가 비어 있을 때 구독하면 서버가 거부하고,
// 한 번 거부된 구독은 로그인 후에도 다시 시도하지 않기 때문에 필요함.
// 반환값은 firebase의 onValue와 같은 "구독 해제 함수".
import { onAuthStateChanged } from 'firebase/auth';
import { onValue as rtdbOnValue } from 'firebase/database';
import { auth } from '../config/firebase';

export function onValueWhenAuthed(queryRef, onNext, onError) {
  let unsubDb = null;
  let cancelled = false;

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    if (unsubDb) {
      unsubDb();
      unsubDb = null;
    }
    if (user && !cancelled) {
      unsubDb = rtdbOnValue(queryRef, onNext, onError);
    }
  });

  return () => {
    cancelled = true;
    unsubAuth();
    if (unsubDb) unsubDb();
  };
}
