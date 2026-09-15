// src/utils/mediaEventTime.js
//
// 타임라인 "사건 발생 시간" 자동 추출 유틸.
// - 사진: EXIF DateTimeOriginal (촬영 시각)
// - 음성/영상: MP4/M4A(ISO Base Media) 컨테이너의 mvhd creation_time (녹화/녹음 시각)
//
// 외부 라이브러리 없이 순수 JS로 바이너리를 파싱한다 (expo-file-system으로 필요한
// 구간만 잘라 읽어서 대용량 파일도 전체를 메모리에 올리지 않도록 함).

import * as FileSystem from 'expo-file-system/legacy';

const HEAD_CHUNK = 2 * 1024 * 1024; // 앞쪽 2MB
const TAIL_CHUNK = 2 * 1024 * 1024; // 뒤쪽 2MB (moov가 파일 끝에 있는 경우 대비)
const EXIF_HEAD_CHUNK = 256 * 1024; // JPEG는 EXIF가 파일 맨 앞부분에 있으므로 256KB면 충분

// ─── base64 → bytes (atob 의존 없이 직접 디코딩) ────────────────────────────

function base64ToUint8Array(base64) {
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < base64.length; i++) {
    const c = base64.charCodeAt(i);
    let value;
    if (c >= 65 && c <= 90) value = c - 65; // A-Z
    else if (c >= 97 && c <= 122) value = c - 97 + 26; // a-z
    else if (c >= 48 && c <= 57) value = c - 48 + 52; // 0-9
    else if (c === 43) value = 62; // +
    else if (c === 47) value = 63; // /
    else continue; // '=' 패딩 등은 건너뜀
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

async function readBytes(uri, position, length) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  });
  return base64ToUint8Array(base64);
}

// ─── 사진: EXIF DateTimeOriginal ─────────────────────────────────────────────

// "YYYY:MM:DD HH:MM:SS" → Date
function parseExifDateString(str) {
  if (typeof str !== 'string') return null;
  const m = str.trim().match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, s);
  return Number.isNaN(date.getTime()) ? null : date;
}

// expo-image-picker가 exif:true 옵션으로 돌려주는 객체에서 촬영 시각 추출
function extractDateFromExifObject(exif) {
  if (!exif || typeof exif !== 'object') return null;
  const candidates = [
    exif.DateTimeOriginal,
    exif.DateTimeDigitized,
    exif.DateTime,
    exif?.['{Exif}']?.DateTimeOriginal,
    exif?.['{TIFF}']?.DateTime,
  ];
  for (const c of candidates) {
    const parsed = parseExifDateString(c);
    if (parsed) return parsed;
  }
  return null;
}

// JPEG 바이너리를 직접 파싱해 EXIF DateTimeOriginal(또는 DateTime)을 찾는다.
// asset.exif가 없는 플랫폼/피커에서의 보조 수단.
function parseJpegExifDate(bytes) {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // SOI 확인

    let offset = 2;
    let app1Start = null;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      if (marker === 0xffe1) {
        app1Start = offset;
        break;
      }
      if ((marker & 0xff00) !== 0xff00) break; // 마커가 아님
      if (marker === 0xffd8 || marker === 0xffd9) {
        offset += 2;
        continue;
      }
      const segLength = view.getUint16(offset + 2);
      offset += 2 + segLength;
    }
    if (app1Start == null) return null;

    const exifHeaderOffset = app1Start + 4; // marker(2) + length(2)
    // "Exif\0\0" 확인
    if (
      view.getUint8(exifHeaderOffset) !== 0x45 ||
      view.getUint8(exifHeaderOffset + 1) !== 0x78 ||
      view.getUint8(exifHeaderOffset + 2) !== 0x69 ||
      view.getUint8(exifHeaderOffset + 3) !== 0x66
    ) {
      return null;
    }

    const tiffStart = exifHeaderOffset + 6;
    const byteOrderMark = view.getUint16(tiffStart);
    const little = byteOrderMark === 0x4949; // 'II'
    const getU16 = (o) => view.getUint16(o, little);
    const getU32 = (o) => view.getUint32(o, little);

    const ifd0Offset = tiffStart + getU32(tiffStart + 4);

    function readIfd(ifdOffset) {
      const entryCount = getU16(ifdOffset);
      const entries = [];
      for (let i = 0; i < entryCount; i++) {
        const entryOffset = ifdOffset + 2 + i * 12;
        const tag = getU16(entryOffset);
        const type = getU16(entryOffset + 2);
        const count = getU32(entryOffset + 4);
        entries.push({ tag, type, count, entryOffset });
      }
      return entries;
    }

    function readAsciiValue(entry) {
      const { type, count, entryOffset } = entry;
      if (type !== 2) return null; // ASCII 타입만 처리
      const byteLen = count;
      let valueStart;
      if (byteLen <= 4) {
        valueStart = entryOffset + 8;
      } else {
        valueStart = tiffStart + getU32(entryOffset + 8);
      }
      let str = '';
      for (let i = 0; i < byteLen; i++) {
        const code = view.getUint8(valueStart + i);
        if (code === 0) break;
        str += String.fromCharCode(code);
      }
      return str;
    }

    const ifd0Entries = readIfd(ifd0Offset);

    // Exif SubIFD(0x8769) 안의 DateTimeOriginal(0x9003) 우선
    const exifIfdEntry = ifd0Entries.find((e) => e.tag === 0x8769);
    if (exifIfdEntry) {
      const exifIfdOffset = tiffStart + getU32(exifIfdEntry.entryOffset + 8);
      const exifEntries = readIfd(exifIfdOffset);
      const dtOriginal = exifEntries.find((e) => e.tag === 0x9003);
      if (dtOriginal) {
        const parsed = parseExifDateString(readAsciiValue(dtOriginal));
        if (parsed) return parsed;
      }
    }

    // IFD0의 DateTime(0x0132) 폴백
    const dtEntry = ifd0Entries.find((e) => e.tag === 0x0132);
    if (dtEntry) {
      return parseExifDateString(readAsciiValue(dtEntry));
    }
    return null;
  } catch (e) {
    console.warn('JPEG EXIF 파싱 실패:', e.message);
    return null;
  }
}

/**
 * 사진 촬영 시각(EXIF DateTimeOriginal)을 읽는다.
 * @param {{ uri: string, exif?: object, mimeType?: string }} params
 * @returns {Promise<Date|null>}
 */
export async function extractPhotoCaptureDate({ uri, exif, mimeType } = {}) {
  // 1순위: expo-image-picker가 이미 파싱해준 exif 객체
  const fromExifObject = extractDateFromExifObject(exif);
  if (fromExifObject) return fromExifObject;

  // 2순위: JPEG 바이너리 직접 파싱 (PNG 등 EXIF 없는 포맷은 실패 → null)
  if (!uri) return null;
  if (mimeType && !/jpe?g/i.test(mimeType)) return null;
  try {
    const bytes = await readBytes(uri, 0, EXIF_HEAD_CHUNK);
    return parseJpegExifDate(bytes);
  } catch (e) {
    console.warn('사진 EXIF 읽기 실패:', e.message);
    return null;
  }
}

// ─── 음성/영상: MP4/M4A(ISO Base Media) mvhd creation_time ─────────────────

const MP4_EPOCH_OFFSET_SEC = 2082844800; // 1904-01-01 → 1970-01-01 초 차이

function findBox(view, start, end, targetType) {
  let offset = start;
  while (offset + 8 <= end) {
    let size = view.getUint32(offset);
    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7)
    );
    let headerSize = 8;
    if (size === 1) {
      // 64비트 확장 크기 (largesize)
      if (offset + 16 > end) break;
      const hi = view.getUint32(offset + 8);
      const lo = view.getUint32(offset + 12);
      size = hi * 4294967296 + lo;
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset; // 파일/버퍼 끝까지
    }
    if (size < headerSize) break; // 손상된 박스 — 안전하게 중단

    if (type === targetType) {
      return { start: offset, contentStart: offset + headerSize, contentEnd: offset + size };
    }
    offset += size;
  }
  return null;
}

function findMvhdCreationTimeSec(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const moov = findBox(view, 0, bytes.byteLength, 'moov');
  if (!moov) return null;
  const mvhd = findBox(view, moov.contentStart, moov.contentEnd, 'mvhd');
  if (!mvhd) return null;

  const version = view.getUint8(mvhd.contentStart);
  if (version === 1) {
    const hi = view.getUint32(mvhd.contentStart + 4);
    const lo = view.getUint32(mvhd.contentStart + 8);
    return hi * 4294967296 + lo;
  }
  return view.getUint32(mvhd.contentStart + 4);
}

/**
 * MP4/M4A 컨테이너의 mvhd creation_time을 읽어 실제 촬영/녹음 시각을 구한다.
 * moov 박스가 파일 앞쪽(faststart)/뒤쪽 어디에 있어도 대응하도록 앞·뒤 청크를 모두 시도한다.
 * @param {string} uri
 * @returns {Promise<Date|null>}
 */
export async function extractContainerCreationTime(uri) {
  if (!uri) return null;
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (!info.exists || !info.size) return null;

    const head = await readBytes(uri, 0, Math.min(HEAD_CHUNK, info.size));
    let creationSec = findMvhdCreationTimeSec(head);

    if (!creationSec && info.size > HEAD_CHUNK) {
      const tailLength = Math.min(TAIL_CHUNK, info.size);
      const tail = await readBytes(uri, info.size - tailLength, tailLength);
      creationSec = findMvhdCreationTimeSec(tail);
    }

    if (!creationSec) return null;

    const unixSec = creationSec - MP4_EPOCH_OFFSET_SEC;
    if (unixSec <= 0) return null;

    const date = new Date(unixSec * 1000);
    // 방어적 검증: 2000년 이전이거나 미래 시각이면 잘못 읽은 것으로 보고 폐기
    if (date.getFullYear() < 2000 || date.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      return null;
    }
    return date;
  } catch (e) {
    console.warn('MP4/M4A 생성시각 읽기 실패:', e.message);
    return null;
  }
}

/**
 * 파일 확장자/MIME 타입으로 봤을 때 ISO Base Media(mp4/m4a/mov) 컨테이너인지 대략 판단.
 * (녹음/촬영 시각 자동 추출을 시도해볼 가치가 있는지 미리 걸러내는 용도)
 */
export function looksLikeIsoBaseMediaFile({ mimeType, name } = {}) {
  if (mimeType && /(mp4|m4a|quicktime|x-m4a)/i.test(mimeType)) return true;
  if (name && /\.(mp4|m4a|mov|3gp)$/i.test(name)) return true;
  return false;
}
