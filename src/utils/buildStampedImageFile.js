// 워터마크가 합성된 캡처 결과(uri)를 기존 업로드 파이프라인이 기대하는 파일 객체 형태로 감싼다.
// webFile(브라우저 File 객체)은 일부러 넣지 않는다 — firebaseService의 uploadFileFromUri가
// webFile을 그대로 올려버리면 워터마크 없는 원본이 업로드되므로, uri로 다시 fetch하도록 강제한다.
export function buildStampedImageFile(originalFile, stampedUri) {
  const baseName = (originalFile?.name || 'photo').replace(/\.[^./\\]+$/, '');
  return {
    uri: stampedUri,
    name: `${baseName}-watermarked.jpg`,
    mimeType: 'image/jpeg',
    size: null,
  };
}
