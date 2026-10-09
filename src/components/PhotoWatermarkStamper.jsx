// src/components/PhotoWatermarkStamper.jsx
//
// 증거 사진을 업로드하기 직전에, 사진 픽셀 자체에 워터마크를 합성한다.
// 화면 어딘가에 <PhotoWatermarkStamper ref={stamperRef} /> 를 한 번 마운트해두고
// stamperRef.current.stamp(원본 uri, text) 를 호출하면, 합성이 끝난 새 이미지의 uri를 돌려준다.
//
// 서버(versatility.cloud) 워터마크와 같은 모양으로 보이도록 맞췄다: 문구 + 현재 시각을
// 반투명 대각선 한 줄로 이미지 중앙에 올리는 스타일("문구와 현재 시간을 반투명 대각선으로
// 합성"— API 문서). watermarkApiService.buildWatermarkText()가 만든 것과 같은 문구를
// text로 넘기면, 서버를 쓰든 로컬을 쓰든 워터마크 내용이 동일하게 남는다.
//
// 원본 파일을 그대로 다운로드/공유해도 워터마크가 함께 찍혀 있도록,
// 보고서(PDF) 위에 얹는 방식이 아니라 이미지 자체를 다시 렌더링해서 캡처하는 방식을 쓴다.
// (react-native-view-shot: 네이티브에서는 실제 뷰를 스냅샷, 웹에서는 html2canvas로 캡처)

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Svg, { Text as SvgText } from 'react-native-svg';

// 캡처 결과가 너무 커지지 않도록 긴 변 기준 최대 너비를 제한한다.
const CAPTURE_MAX_WIDTH = 1080;

// 서버 워터마크와 같은 "문구 한 줄, 반투명, 대각선, 이미지 중앙" 스타일.
// 실제 서버 결과물과 비교해보니(스크린샷 기준) 각도가 이미지 비율에 따라 변하지 않고
// 고정된 완만한 각도였고, 글자 크기도 더 작고 테두리(stroke) 없이 더 은은했다. 그에 맞춰 조정.
const WATERMARK_ANGLE_DEG = -18; // 서버 결과물과 비슷한, 완만한 고정 각도
function DiagonalWatermark({ width, height, text }) {
  const fontSize = Math.max(12, Math.min(width, height) * 0.038);
  const cx = width / 2;
  const cy = height / 2;
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <SvgText
        x={cx}
        y={cy}
        fontSize={fontSize}
        fontWeight="600"
        fill="rgba(255,255,255,0.55)"
        textAnchor="middle"
        transform={`rotate(${WATERMARK_ANGLE_DEG}, ${cx}, ${cy})`}
      >
        {text}
      </SvgText>
    </Svg>
  );
}

export const PhotoWatermarkStamper = forwardRef(function PhotoWatermarkStamper(_props, ref) {
  const captureViewRef = useRef(null);
  const jobRef = useRef(null);
  const [job, setJob] = useState(null); // { uri, width, height, text }

  useImperativeHandle(ref, () => ({
    // 원본 사진 uri를 받아 워터마크가 합성된 새 이미지의 uri를 돌려준다.
    // text를 안 넘기면 기본 문구("THEMIS 원본")만 찍는다 — 서버와 내용을 맞추려면
    // watermarkApiService.buildWatermarkText()로 만든 문구를 그대로 넘기면 된다.
    stamp(uri, text = 'THEMIS 원본') {
      return new Promise((resolve, reject) => {
        Image.getSize(
          uri,
          (naturalWidth, naturalHeight) => {
            const scale = Math.min(1, CAPTURE_MAX_WIDTH / naturalWidth);
            const width = Math.max(1, Math.round(naturalWidth * scale));
            const height = Math.max(1, Math.round(naturalHeight * scale));
            jobRef.current = { uri, width, height, text, resolve, reject };
            setJob({ uri, width, height, text });
          },
          (error) => reject(error)
        );
      });
    },
  }));

  async function handleImageLoad() {
    const currentJob = jobRef.current;
    if (!currentJob) return;
    try {
      // onLoad는 "이미지 리소스를 다 읽었다"는 뜻이지 "화면에 실제로 다 그려졌다"는 뜻이
      // 아니다. 이 간격이 부족하면 캡처 결과가 새까맣게 나오는 경우가 있어서(실제로 겪은
      // 문제), rAF 한 번이 아니라 두 번 + 짧은 지연으로 페인팅이 끝날 시간을 확실히 준다.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => setTimeout(resolve, 120));
      const capturedUri = await captureRef(captureViewRef, {
        format: 'jpg',
        quality: 0.9,
        result: 'tmpfile',
        width: currentJob.width,
        height: currentJob.height,
      });
      currentJob.resolve(capturedUri);
    } catch (error) {
      currentJob.reject(error);
    } finally {
      jobRef.current = null;
      setJob(null);
    }
  }

  function handleImageError() {
    const currentJob = jobRef.current;
    jobRef.current = null;
    setJob(null);
    currentJob?.reject(new Error('워터마크 합성용 이미지를 불러오지 못했습니다.'));
  }

  if (!job) return null;

  return (
    // 화면 밖으로 밀어내 사용자 눈에는 보이지 않지만, display:none이 아니라 실제로 레이아웃되고
    // 있어야 캡처가 가능하다(RN/html2canvas 모두 display:none인 뷰는 캡처하지 못한다).
    <View style={styles.offscreen} pointerEvents="none">
      <View ref={captureViewRef} collapsable={false} style={{ width: job.width, height: job.height }}>
        <Image
          source={{ uri: job.uri }}
          style={{ width: job.width, height: job.height }}
          resizeMode="cover"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
        <DiagonalWatermark width={job.width} height={job.height} text={job.text} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // 화면 아주 멀리(-100000) 밀어내면 일부 기기의 GPU/렌더 파이프라인이 그 좌표의 텍스처를
  // 제대로 그리지 못해 캡처가 새까맣게 나오는 경우가 있었다(실제로 겪은 문제).
  // opacity:0도 같은 이유로 피한다(완전 투명 뷰는 아예 페인팅을 건너뛰는 기기가 있음).
  // 대신 적당히만 화면 밖으로 밀어서(-3000) 사용자 눈엔 안 보이면서도 정상적으로 그려지게 한다.
  offscreen: { position: 'absolute', top: -3000, left: 0 },
});
