export interface ImageSize {
  width: number
  height: number
}

/**
 * 只看文件头就能读出宽高：PNG 在 IHDR 里，JPEG 要翻一遍标记段，WebP 看容器类型。
 * 知道尺寸才能在解码之前拦住「几百像素宽、解开几百兆内存」的那种图。
 */
export function readImageSize(bytes: Uint8Array): ImageSize | null {
  return readPngSize(bytes) ?? readJpegSize(bytes) ?? readWebpSize(bytes)
}

function readPngSize(bytes: Uint8Array): ImageSize | null {
  /* 8 字节签名 + 4 字节长度 + "IHDR" + 宽高各 4 字节 */
  if (bytes.length < 24) return null
  if (bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) return null
  const width = readUint32(bytes, 16)
  const height = readUint32(bytes, 20)
  if (!width || !height) return null
  return { width, height }
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
  )
}

/** JPEG 的尺寸藏在 SOF 段里，从头一段段翻过去。 */
function readJpegSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1]
    /* 填充字节 */
    if (marker === 0xff) {
      offset += 1
      continue
    }
    /* 帧开始标记：没有长度字段 */
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2
      continue
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2
      continue
    }
    const isFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
    if (isFrame) {
      if (offset + 9 > bytes.length) return null
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6]
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8]
      if (!width || !height) return null
      return { width, height }
    }
    if (length < 2) return null
    offset += 2 + length
  }
  return null
}

function readWebpSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 30) return null
  if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) return null
  if (bytes[8] !== 0x57 || bytes[9] !== 0x45 || bytes[10] !== 0x42 || bytes[11] !== 0x50) return null
  const format = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15])
  if (format === 'VP8 ') {
    /* 帧头和起始码之后是 14 位的宽高 */
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff
    return width && height ? { width, height } : null
  }
  if (format === 'VP8L') {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)
    const width = (bits & 0x3fff) + 1
    const height = ((bits >> 14) & 0x3fff) + 1
    return { width, height }
  }
  if (format === 'VP8X') {
    const width = (bytes[20] | (bytes[21] << 8) | (bytes[22] << 16)) + 1
    const height = (bytes[23] | (bytes[24] << 8) | (bytes[25] << 16)) + 1
    return { width, height }
  }
  return null
}
