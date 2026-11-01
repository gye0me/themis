// src/utils/base64.js
//
// base64 문자열을 바이트 배열로 바꾼다. fetch 본문으로 그대로 보낼 수 있고 앱·웹에서 똑같이 동작한다.
// fetch('data:...')는 Android에서 실패하므로 쓰지 않는다 (docs/WEB_APP_COMPAT.md 참고).

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Map([...ALPHABET].map((char, index) => [char, index]));

export function base64ToBytes(base64) {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let offset = 0;

  for (const char of clean) {
    buffer = (buffer << 6) | LOOKUP.get(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[offset] = (buffer >> bits) & 0xff;
      offset += 1;
    }
  }
  return bytes;
}
