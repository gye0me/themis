// src/components/CasePickerModal.jsx
//
// "어느 사건 타임라인에 저장할까요?" — 내 사건 목록에서 하나를 고르는 공용 모달.
// 기록 탭의 빠른 기록(사진/음성/영상/계약서)처럼 사건을 정하지 않고 시작한 기록을
// 특정 사건 타임라인에 저장할 때 쓴다.

import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { getCasesByUser } from '../services/firebaseService';
import { CASE_TYPE_META } from '../services/responseGuideSteps';
import { C } from '../theme/tokens';

export function CasePickerModal({
  visible,
  userId,
  title = '어느 사건 타임라인에 저장할까요?',
  description,
  onSelect, // (caseDoc) => void
  onCancel,
  onCreateNew, // 선택: "+ 새 사건 만들기"를 보여주려면 전달
}) {
  const [cases, setCases] = useState(null); // null = 아직 불러오는 중
  const loading = cases === null;

  // 열릴 때마다 최신 사건 목록을 다시 불러온다
  useEffect(() => {
    if (!visible || !userId) return;
    let active = true;
    getCasesByUser(userId)
      .then((list) => {
        if (!active) return;
        setCases([...list].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
      })
      .catch((err) => {
        console.error('사건 목록 조회 오류:', err);
        if (active) setCases([]);
      });
    return () => {
      active = false;
    };
  }, [visible, userId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {description ? <Text style={styles.desc}>{description}</Text> : null}

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={C.brand600} />
            </View>
          ) : cases.length === 0 ? (
            <Text style={styles.empty}>아직 등록된 사건이 없어요.</Text>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={{ gap: 8 }}>
              {cases.map((c) => {
                const meta = CASE_TYPE_META[c.caseType] ?? { icon: '📁', label: c.caseType ?? '기타' };
                return (
                  <TouchableOpacity key={c.id} style={styles.row} onPress={() => onSelect(c)} activeOpacity={0.8}>
                    <View style={styles.rowIcon}>
                      <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{c.title || '이름 없는 사건'}</Text>
                      <Text style={styles.rowMeta}>{meta.label}</Text>
                    </View>
                    <Text style={styles.rowArrow}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {onCreateNew && (
            <TouchableOpacity style={styles.dashedRow} onPress={onCreateNew}>
              <Text style={styles.dashedRowText}>+ 새 사건 만들기</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>취소</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, paddingBottom: 24, gap: 12, maxHeight: '80%',
  },
  title: { fontSize: 16, fontWeight: '700', color: C.ink900 },
  desc: { fontSize: 12, color: C.ink500, lineHeight: 18 },
  loadingBox: { paddingVertical: 30, alignItems: 'center' },
  empty: { fontSize: 13, color: C.ink400, textAlign: 'center', paddingVertical: 20 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.sky050, borderRadius: 14, padding: 12,
  },
  rowIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: C.ink900 },
  rowMeta: { fontSize: 11, color: C.ink400, marginTop: 2 },
  rowArrow: { fontSize: 20, color: C.ink400 },
  dashedRow: {
    borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
  },
  dashedRowText: { color: C.brand600, fontSize: 13, fontWeight: '700' },
  cancelBtn: { borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  cancelBtnText: { color: C.ink500, fontSize: 13, fontWeight: '600' },
});
