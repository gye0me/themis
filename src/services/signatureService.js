// 전자서명 기록 서비스 — Firestore 컬렉션: signatures (write-once, 수정·삭제 불가)
//
// 전문가 인증 신청/승인, 공론화 SOS 발동처럼 "누가 언제 무엇에 동의/책임졌는지"가
// 나중에 문제될 수 있는 행위에 대해, 서명 시점의 내용 해시 + 타이핑한 본인 이름 +
// 서명 문구를 별도 컬렉션에 남긴다. firestore.rules에서 이 컬렉션은 생성만 허용하고
// 수정·삭제를 막아둬서, 한 번 서명되면 아무도(관리자 포함) 사후에 바꿀 수 없다.

import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { addDocument } from './firebaseService';

const COLLECTION = 'signatures';

// 서명 대상 내용을 키 순서에 상관없이 항상 같은 문자열로 만든다 —
// 나중에 원본 데이터가 바뀌면 해시가 달라져서 "서명 당시와 다르다"는 걸 알 수 있다.
function canonicalize(obj) {
  return JSON.stringify(obj ?? {}, Object.keys(obj ?? {}).sort());
}

export async function hashContent(content) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonicalize(content));
}

/**
 * 전자서명 기록 생성.
 * targetType: 'expertVerificationSubmit' | 'expertVerificationReview' | 'hotBoardSos'
 * 반환값: 생성된 signatures 문서 id (서명 대상 문서에 signatureId로 같이 저장해두면 추적 가능)
 */
export async function createElectronicSignature({
  signerUid,
  signerName,
  typedName,
  statementText,
  targetType,
  targetId,
  content,
}) {
  if (!signerUid) throw new Error('로그인이 필요합니다.');
  if (!typedName?.trim()) throw new Error('서명할 이름을 입력해주세요.');

  const contentHash = await hashContent(content);

  return addDocument(COLLECTION, {
    signerUid,
    signerName: signerName ?? typedName.trim(),
    typedName: typedName.trim(),
    statementText,
    targetType,
    targetId: targetId ?? null,
    contentHash,
    platform: Platform.OS,
    signedAtClient: new Date().toISOString(),
  });
}
