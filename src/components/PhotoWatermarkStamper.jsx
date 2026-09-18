// src/components/PhotoWatermarkStamper.jsx
//
// 증거 사진을 업로드하기 직전에, 사진 픽셀 자체에 "THEMIS 원본" 워터마크를 합성한다.
// 화면 어딘가에 <PhotoWatermarkStamper ref={stamperRef} /> 를 한 번 마운트해두고
// stamperRef.current.stamp(원본 uri) 를 호출하면, 합성이 끝난 새 이미지의 uri를 돌려준다.
//
// 원본 파일을 그대로 다운로드/공유해도 워터마크가 함께 찍혀 있도록,
// 보고서(PDF) 위에 얹는 방식이 아니라 이미지 자체를 다시 렌더링해서 캡처하는 방식을 쓴다.
// (react-native-view-shot: 네이티브에서는 실제 뷰를 스냅샷, 웹에서는 html2canvas로 캡처)

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Svg, { Defs, Pattern, Rect, Text as SvgText } from 'react-native-svg';

// 캡처 결과가 너무 커지지 않도록 긴 변 기준 최대 너비를 제한한다.
const CAPTURE_MAX_WIDTH = 1080;

function WatermarkPattern() {
  const tile = 130;
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern
          id="themisWatermark"
          patternUnits="userSpaceOnUse"
          width={tile}
          height={tile}
          patternTransform="rotate(-28)"
        >
          <SvgText x={2} y={tile / 2 - 14} fontSize={15} fontWeight="bold" fill="rgba(255,255,255,0.55)">
            THEMIS 원본
          </SvgText>
          <SvgText x={2} y={tile / 2 + 30} fontSize={15} fontWeight="bold" fill="rgba(30,58,95,0.4)">
            THEMIS 원본
          </SvgText>
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#themisWatermark)" />
    </Svg>
  );
}

export const PhotoWatermarkStamper = forwardRef(function PhotoWatermarkStamper(_props, ref) {
  const captureViewRef = useRef(null);
  const jobRef = useRef(null);
  const [job, setJob] = useState(null); // { uri, width, height }

  useImperativeHandle(ref, () => ({
    // 원본 사진 uri를 받아 워터마크가 합성된 새 이미지의 uri를 돌려준다.
    stamp(uri) {
      return new Promise((resolve, reject) => {
        Image.getSize(
          uri,
          (naturalWidth, naturalHeight) => {
            const scale = Math.min(1, CAPTURE_MAX_WIDTH / naturalWidth);
            const width = Math.max(1, Math.round(naturalWidth * scale));
            const height = Math.max(1, Math.round(naturalHeight * scale));
            jobRef.current = { uri, width, height, resolve, reject };
            setJob({ uri, width, height });
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
      // 레이아웃이 실제로 반영된 다음 캡처해야 잘리거나 빈 화면이 찍히지 않는다.
      await new Promise((resolve) => requestAnimationFrame(resolve));
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
        <WatermarkPattern />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', top: 0, left: -100000 },
});
