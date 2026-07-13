import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_PREVIEW_WIDTH = 1800;
const BRIGHTNESS_SHIFT = 12;
const CONTRAST_RATIO = 1.18;

function clampChannel(value) {
  return Math.max(0, Math.min(255, value));
}

function getOrientationRotation(exif = null) {
  const orientation = exif?.Orientation ?? exif?.orientation ?? null;

  switch (orientation) {
    case 3:
      return 180;
    case 6:
      return 90;
    case 8:
      return 270;
    default:
      return 0;
  }
}

async function loadWebImage(uri) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    image.src = uri;
  });
}

export async function readImageBase64FromUri(uri) {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result.split(',')[1] ?? result);
        } else {
          reject(new Error('이미지 데이터를 읽지 못했습니다.'));
        }
      };
      reader.onerror = () => reject(new Error('이미지 데이터를 읽지 못했습니다.'));
      reader.readAsDataURL(blob);
    });
  }

  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

function applyWebToneAdjustment(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return canvas;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];

    data[index] = clampChannel((red - 128) * CONTRAST_RATIO + 128 + BRIGHTNESS_SHIFT);
    data[index + 1] = clampChannel((green - 128) * CONTRAST_RATIO + 128 + BRIGHTNESS_SHIFT);
    data[index + 2] = clampChannel((blue - 128) * CONTRAST_RATIO + 128 + BRIGHTNESS_SHIFT);
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function createRotatedCanvas(sourceImage, rotationDegrees) {
  const normalizedRotation = ((rotationDegrees % 360) + 360) % 360;
  if (!normalizedRotation) {
    const canvas = document.createElement('canvas');
    canvas.width = sourceImage.width;
    canvas.height = sourceImage.height;
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(sourceImage, 0, 0);
    }
    return canvas;
  }

  const canvas = document.createElement('canvas');
  const swapDimensions = normalizedRotation === 90 || normalizedRotation === 270;
  canvas.width = swapDimensions ? sourceImage.height : sourceImage.width;
  canvas.height = swapDimensions ? sourceImage.width : sourceImage.height;

  const context = canvas.getContext('2d');
  if (!context) return canvas;

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((normalizedRotation * Math.PI) / 180);
  context.drawImage(sourceImage, -sourceImage.width / 2, -sourceImage.height / 2);
  return canvas;
}

function resizeCanvas(canvas, maxWidth = MAX_PREVIEW_WIDTH) {
  if (canvas.width <= maxWidth) return canvas;

  const ratio = maxWidth / canvas.width;
  const resized = document.createElement('canvas');
  resized.width = Math.round(canvas.width * ratio);
  resized.height = Math.round(canvas.height * ratio);

  const context = resized.getContext('2d');
  if (!context) return canvas;

  context.drawImage(canvas, 0, 0, resized.width, resized.height);
  return resized;
}

export async function preprocessContractImage({ uri, exif = null, enableEnhancement = true }) {
  const rotationDegrees = getOrientationRotation(exif);

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const sourceImage = await loadWebImage(uri);
    const rotatedCanvas = createRotatedCanvas(sourceImage, rotationDegrees);
    const sizedCanvas = resizeCanvas(rotatedCanvas);
    const enhancedCanvas = enableEnhancement ? applyWebToneAdjustment(sizedCanvas) : sizedCanvas;
    const dataUrl = enhancedCanvas.toDataURL('image/jpeg', 0.92);

    return {
      uri: dataUrl,
      base64: dataUrl.split(',')[1] ?? null,
      mimeType: 'image/jpeg',
      rotationDegrees,
      processed: true,
    };
  }

  const actions = [];
  if (rotationDegrees) {
    actions.push({ rotate: rotationDegrees });
  }
  actions.push({ resize: { width: MAX_PREVIEW_WIDTH } });

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.92,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  return {
    uri: result.uri,
    base64: result.base64 ?? null,
    mimeType: 'image/jpeg',
    rotationDegrees,
    processed: true,
  };
}
