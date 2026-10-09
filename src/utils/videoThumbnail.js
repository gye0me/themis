// src/utils/videoThumbnail.js
//
// 영상 증거의 "N초 스탬프" 썸네일 생성.
// expo-video-thumbnails는 웹을 지원하지 않아(호출 시 에러) 웹에서 올린 영상에는 썸네일이 아예
// 저장되지 않았다 → 웹은 브라우저 <video> + <canvas>로 직접 프레임을 캡처한다.
// 영상이 원하는 시점보다 짧으면 영상 중간 지점을 캡처한다.

import { Platform } from 'react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';

/**
 * @returns {Promise<{ uri: string, stampSec: number }>} uri는 앱에선 파일 경로, 웹에선 JPEG data URI
 */
export async function getVideoThumbnail(videoUri, targetSec = 5) {
  if (Platform.OS === 'web') return captureFrameOnWeb(videoUri, targetSec);
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: targetSec * 1000 });
    return { uri, stampSec: targetSec };
  } catch {
    // 영상이 targetSec보다 짧은 경우 등 → 첫 화면으로 대체
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 0 });
    return { uri, stampSec: 0 };
  }
}

function captureFrameOnWeb(videoUri, targetSec) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    let stampSec = targetSec;
    const timer = setTimeout(() => cleanup(new Error('영상 프레임 캡처 시간 초과')), 15000);

    function cleanup(err, result) {
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      if (err) reject(err);
      else resolve(result);
    }

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      stampSec = duration > targetSec ? targetSec : Math.floor((duration / 2) * 10) / 10;
      video.currentTime = stampSec;
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        cleanup(null, { uri: canvas.toDataURL('image/jpeg', 0.8), stampSec });
      } catch (e) {
        cleanup(e);
      }
    };
    video.onerror = () => cleanup(new Error('영상을 불러오지 못했습니다.'));
    video.src = videoUri;
  });
}
