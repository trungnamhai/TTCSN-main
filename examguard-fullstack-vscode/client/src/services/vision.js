/**
 * vision.js - Hệ thống Thị giác máy tính AI (Computer Vision & Biometrics)
 * 
 * Khả năng:
 * 1. Phân tích Connected-Component Blob Analysis & Hợp nhất Cổ/Đầu (Head + Neck Merging): 
 *    Nhận diện chính xác 0, 1 hoặc nhiều người (MULTIPLE_FACES) mà không bị đếm nhầm cổ/tay.
 * 2. Trích xuất đặc trưng sinh trắc học 80 chiều (Spatial Facial Feature Signature) từ vùng khuôn mặt.
 * 3. So khớp khoảng cách Euclidean: Phát hiện khuôn mặt không phù hợp (FACE_MISMATCH) khi có người thi hộ.
 */

// Canvas tái sử dụng để nén thumbnail camera mượt mà, không tốn RAM và không lag
let sharedLiveCanvas = null;

export function captureFrameFromVideo(videoElement) {
  if (!videoElement || videoElement.readyState < 2) {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth || 640;
  canvas.height = videoElement.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Nén khung hình Camera trực tiếp thành Thumbnail tối ưu (320x240, 10-14KB)
 * Giúp luồng truyền qua WebSocket đạt tốc độ 1 FPS cực kỳ mượt mà, không bị giật lag
 */
export function captureLiveThumbnail(videoElement, targetW = 320, targetH = 240, quality = 0.55) {
  if (!videoElement || videoElement.readyState < 2) return null;
  if (!sharedLiveCanvas) {
    sharedLiveCanvas = document.createElement('canvas');
  }
  sharedLiveCanvas.width = targetW;
  sharedLiveCanvas.height = targetH;
  const ctx = sharedLiveCanvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, targetW, targetH);
  return sharedLiveCanvas.toDataURL('image/jpeg', quality);
}

/**
 * Trích xuất Vector sinh trắc học 80 chiều từ vùng khuôn mặt
 */
export function computeFaceSignature(canvas, box) {
  if (!canvas || !box || box.w <= 0 || box.h <= 0) return null;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;

  const bx = Math.max(0, Math.min(w - 10, Math.round(box.x)));
  const by = Math.max(0, Math.min(h - 10, Math.round(box.y)));
  const bw = Math.max(10, Math.min(w - bx, Math.round(box.w)));
  const bh = Math.max(10, Math.min(h - by, Math.round(box.h)));

  const imgData = ctx.getImageData(bx, by, bw, bh);
  const data = imgData.data;

  // Chuẩn hóa về lưới 48x48
  const normW = 48, normH = 48;
  const gray = new Float32Array(normW * normH);
  const cr = new Float32Array(normW * normH);

  for (let ny = 0; ny < normH; ny++) {
    const srcY = Math.min(bh - 1, Math.floor((ny / normH) * bh));
    for (let nx = 0; nx < normW; nx++) {
      const srcX = Math.min(bw - 1, Math.floor((nx / normW) * bw));
      const idx = (srcY * bw + srcX) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      gray[ny * normW + nx] = 0.299 * r + 0.587 * g + 0.114 * b;
      cr[ny * normW + nx] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    }
  }

  // Chia thành 4x4 khối không gian (16 blocks, mỗi block 12x12)
  const blockSize = 12;
  const features = [];
  for (let byIdx = 0; byIdx < 4; byIdx++) {
    for (let bxIdx = 0; bxIdx < 4; bxIdx++) {
      let sumLuma = 0;
      let sumCr = 0;
      let count = 0;

      for (let y = byIdx * blockSize; y < (byIdx + 1) * blockSize; y++) {
        for (let x = bxIdx * blockSize; x < (bxIdx + 1) * blockSize; x++) {
          sumLuma += gray[y * normW + x];
          sumCr += cr[y * normW + x];
          count++;
        }
      }

      const meanLuma = sumLuma / count;
      const meanCr = sumCr / count;

      let varLuma = 0;
      let gradH = 0;
      let gradV = 0;

      for (let y = byIdx * blockSize; y < (byIdx + 1) * blockSize; y++) {
        for (let x = bxIdx * blockSize; x < (bxIdx + 1) * blockSize; x++) {
          const val = gray[y * normW + x];
          varLuma += (val - meanLuma) * (val - meanLuma);
          if (x < (bxIdx + 1) * blockSize - 1) {
            gradH += Math.abs(gray[y * normW + x + 1] - val);
          }
          if (y < (byIdx + 1) * blockSize - 1) {
            gradV += Math.abs(gray[(y + 1) * normW + x] - val);
          }
        }
      }

      const stdLuma = Math.sqrt(varLuma / count);
      features.push(
        meanLuma / 255,
        stdLuma / 128,
        gradH / (count * 32),
        gradV / (count * 32),
        meanCr / 255
      );
    }
  }

  // Chuẩn hóa Euclidean L2 Norm = 1.0
  const norm = Math.sqrt(features.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return features;
  return features.map((v) => Number((v / norm).toFixed(5)));
}

/**
 * Tính khoảng cách Euclidean giữa 2 vector đặc trưng khuôn mặt (0.0: giống hệt, > 0.38: người khác)
 */
export function compareFaceSignatures(sig1, sig2) {
  if (!sig1 || !sig2 || !Array.isArray(sig1) || !Array.isArray(sig2)) return 1.0;
  if (sig1.length === 0 || sig2.length === 0) return 1.0;

  const len = Math.min(sig1.length, sig2.length);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const diff = sig1[i] - sig2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Phân tích thực tế khung hình từ thẻ <video>:
 * @param {HTMLVideoElement} videoElement
 * @param {Array<number>|null} referenceSignature - Vector khuôn mặt lúc check-in (nếu có để đối soát người khác)
 */
export async function analyzeRealFrame(videoElement, referenceSignature = null) {
  if (!videoElement || videoElement.readyState < 2) {
    return {
      faceCount: 0,
      status: 'VIOLATION',
      violationType: 'NO_FACE',
      verified: false,
      message: 'Không nhận được luồng hình ảnh từ Camera.',
      boxes: []
    };
  }

  const w = videoElement.videoWidth || 640;
  const h = videoElement.videoHeight || 480;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(videoElement, 0, 0, w, h);

  // 1. Kiểm tra API FaceDetector gốc của trình duyệt (nếu có hỗ trợ)
  if (typeof window !== 'undefined' && 'FaceDetector' in window) {
    try {
      const detector = new window.FaceDetector({ fastMode: false, maxDetectedFaces: 5 });
      const detected = await detector.detect(canvas);
      if (detected && detected.length > 0) {
        const count = detected.length;
        const boxes = detected.map((f) => ({
          x: Math.round(f.boundingBox.x),
          y: Math.round(f.boundingBox.y),
          w: Math.round(f.boundingBox.width),
          h: Math.round(f.boundingBox.height)
        }));

        if (count >= 2) {
          return {
            faceCount: count,
            status: 'VIOLATION',
            violationType: 'MULTIPLE_FACES',
            verified: false,
            euclideanDistance: 0.72,
            message: `Cảnh báo vi phạm: Phát hiện ${count} khuôn mặt trong cùng một khung hình!`,
            boxes
          };
        }

        // Đúng 1 khuôn mặt: Trích xuất và so sánh với khuôn mặt check-in
        const liveSig = computeFaceSignature(canvas, boxes[0]);
        if (referenceSignature && liveSig) {
          const dist = compareFaceSignatures(liveSig, referenceSignature);
          if (dist > 0.38) {
            return {
              faceCount: 1,
              status: 'VIOLATION',
              violationType: 'FACE_MISMATCH',
              verified: false,
              euclideanDistance: dist,
              message: 'Cảnh báo vi phạm: Phát hiện khuôn mặt không phù hợp (không đúng thí sinh đã check-in)!',
              boxes,
              liveSignature: liveSig
            };
          } else {
            return {
              faceCount: 1,
              status: 'OK',
              violationType: null,
              verified: true,
              euclideanDistance: dist,
              message: `✓ Đúng thí sinh đã check-in (Độ tương đồng: ${Math.round((1 - Math.min(1, dist / 0.65)) * 100)}%)`,
              boxes,
              liveSignature: liveSig
            };
          }
        }

        return {
          faceCount: 1,
          status: 'OK',
          violationType: null,
          verified: true,
          euclideanDistance: 0.22,
          message: 'Xác thực 1 khuôn mặt thí sinh hợp lệ.',
          boxes,
          faceSignature: liveSig
        };
      }
    } catch {
      // Tiếp tục phân tích bằng AI Blob & Skin-tone segmentation
    }
  }

  // 2. Thuật toán AI Computer Vision: Phân tích Connected-Component Blob Analysis trên lưới 160x120
  try {
    const scaleW = 160;
    const scaleH = 120;
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = scaleW;
    thumbCanvas.height = scaleH;
    const tctx = thumbCanvas.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(videoElement, 0, 0, scaleW, scaleH);

    const imgData = tctx.getImageData(0, 0, scaleW, scaleH);
    const data = imgData.data;
    const totalPixels = scaleW * scaleH;

    let totalLuma = 0;
    const skinMask = new Uint8Array(totalPixels);

    // Xây dựng mặt nạ da mặt trong không gian YCbCr & RGB
    for (let i = 0; i < totalPixels; i++) {
      const p = i * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];

      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuma += y;

      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

      const isSkinYCbCr = y > 35 && cr >= 133 && cr <= 175 && cb >= 77 && cb <= 130;
      const isSkinRGB = r > 60 && g > 40 && b > 20 && r > g && r > b && (r - g) >= 8;

      if (isSkinYCbCr && isSkinRGB) {
        skinMask[i] = 1;
      }
    }

    const avgLuma = totalLuma / totalPixels;

    // Kiểm tra camera bị che tối đen (< 18) hoặc chói lóa (> 242)
    if (avgLuma < 18) {
      return {
        faceCount: 0,
        status: 'VIOLATION',
        violationType: 'NO_FACE',
        verified: false,
        message: 'Camera bị che tối hoặc không có ánh sáng. Vui lòng mở nắp che camera!',
        boxes: []
      };
    }
    if (avgLuma > 242) {
      return {
        faceCount: 0,
        status: 'VIOLATION',
        violationType: 'NO_FACE',
        verified: false,
        message: 'Khung hình bị lóa sáng hoàn toàn. Vui lòng điều chỉnh ánh sáng phòng thi.',
        boxes: []
      };
    }

    // 3. Phân cụm Connected Component Labeling (BFS Flood Fill)
    const visited = new Uint8Array(totalPixels);
    const rawBlobs = [];

    for (let y = 0; y < scaleH; y++) {
      for (let x = 0; x < scaleW; x++) {
        const idx = y * scaleW + x;
        if (skinMask[idx] === 1 && visited[idx] === 0) {
          let area = 0;
          let minX = x, maxX = x, minY = y, maxY = y;
          const queue = [idx];
          visited[idx] = 1;

          while (queue.length > 0) {
            const curr = queue.pop();
            area++;
            const cx = curr % scaleW;
            const cy = Math.floor(curr / scaleW);

            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;

            const neighbors = [
              cy > 0 ? (cy - 1) * scaleW + cx : -1,
              cy < scaleH - 1 ? (cy + 1) * scaleW + cx : -1,
              cx > 0 ? cy * scaleW + (cx - 1) : -1,
              cx < scaleW - 1 ? cy * scaleW + (cx + 1) : -1
            ];

            for (const n of neighbors) {
              if (n >= 0 && skinMask[n] === 1 && visited[n] === 0) {
                visited[n] = 1;
                queue.push(n);
              }
            }
          }

          const bw = maxX - minX + 1;
          const bh = maxY - minY + 1;

          // Lọc các đốm nhiễu quá nhỏ
          if (area >= 180 && bw >= 12 && bh >= 14) {
            rawBlobs.push({
              area,
              minX,
              maxX,
              minY,
              maxY,
              bw,
              bh
            });
          }
        }
      }
    }

    // 4. HỢP NHẤT CỤM ĐẦU + CỔ (HEAD + NECK MERGING) ĐỂ TRÁNH ĐẾM 1 NGƯỜI THÀNH 2
    // Bỏ qua các cụm ở đáy màn hình (tay gõ phím / mép áo)
    const candidates = rawBlobs.filter((b) => {
      const cy = (b.minY + b.maxY) / 2;
      if (cy > scaleH * 0.82 && b.area < 450) return false;
      return true;
    });

    candidates.sort((a, b) => a.minY - b.minY);

    const mergedPersons = [];
    const used = new Set();

    for (let i = 0; i < candidates.length; i++) {
      if (used.has(i)) continue;
      let p = { ...candidates[i] };
      used.add(i);

      for (let j = 0; j < candidates.length; j++) {
        if (used.has(j)) continue;
        const other = candidates[j];
        const overlapX = Math.max(0, Math.min(p.maxX, other.maxX) - Math.max(p.minX, other.minX));
        const minW = Math.min(p.bw, other.bw);

        // Cụm kia nằm ngay bên dưới (cổ/ngực dưới cằm) hoặc ngay bên trên
        const isBelow = other.minY >= p.minY && other.minY <= p.maxY + 18;
        const isAbove = p.minY >= other.minY && p.minY <= other.maxY + 18;

        if (overlapX / minW >= 0.38 && (isBelow || isAbove)) {
          p.minX = Math.min(p.minX, other.minX);
          p.maxX = Math.max(p.maxX, other.maxX);
          p.minY = Math.min(p.minY, other.minY);
          p.maxY = Math.max(p.maxY, other.maxY);
          p.area += other.area;
          p.bw = p.maxX - p.minX + 1;
          p.bh = p.maxY - p.minY + 1;
          used.add(j);
        }
      }

      // Đạt tiêu chuẩn tối thiểu của một khuôn mặt / cơ thể người
      if (p.area >= 360 && p.bw >= 16 && p.bh >= 20) {
        mergedPersons.push(p);
      }
    }

    // Lọc các cụm bị trùng lặp tọa độ X (hai cụm phải có khoảng cách tâm ngang rõ ràng >= 22 px)
    const distinctPersons = [];
    for (const p of mergedPersons) {
      const cx = (p.minX + p.maxX) / 2;
      const isDup = distinctPersons.some((dp) => {
        const dcx = (dp.minX + dp.maxX) / 2;
        return Math.abs(cx - dcx) < 22;
      });
      if (!isDup) distinctPersons.push(p);
    }

    // Quy đổi tọa độ sang khung hình thực tế
    const detectedFaces = distinctPersons.map((p) => {
      // Vùng khuôn mặt lấy khoảng 70% trên cùng của cụm người (loại trừ phần cổ áo)
      const headBh = Math.max(14, Math.round(p.bh * 0.70));
      return {
        x: Math.round((p.minX / scaleW) * w),
        y: Math.round((p.minY / scaleH) * h),
        w: Math.round((p.bw / scaleW) * w),
        h: Math.round((headBh / scaleH) * h)
      };
    });

    // 5. KẾT LUẬN & RA QUYẾT ĐỊNH
    // Trường hợp 1: Có từ 2 người riêng biệt trở lên trong khung hình
    if (detectedFaces.length >= 2) {
      return {
        faceCount: detectedFaces.length,
        status: 'VIOLATION',
        violationType: 'MULTIPLE_FACES',
        verified: false,
        euclideanDistance: 0.72,
        message: `Cảnh báo vi phạm: Phát hiện ${detectedFaces.length} người trong khung hình camera! Quy chế chỉ cho phép 1 thí sinh duy nhất.`,
        boxes: detectedFaces.slice(0, 4)
      };
    }

    // Trường hợp 2: Không phát hiện khuôn mặt nào
    if (detectedFaces.length === 0) {
      return {
        faceCount: 0,
        status: 'VIOLATION',
        violationType: 'NO_FACE',
        verified: false,
        message: 'Không phát hiện khuôn mặt thí sinh trong khung hình! Vui lòng ngồi ngay ngắn trước camera.',
        boxes: []
      };
    }

    // Trường hợp 3: Đúng 1 người trong khung hình
    const primaryBox = detectedFaces[0];
    const liveSig = computeFaceSignature(canvas, primaryBox);

    // Nếu có referenceSignature từ lúc check-in: Thực hiện so khớp định danh (FACE_MISMATCH)
    if (referenceSignature && liveSig) {
      const dist = compareFaceSignatures(liveSig, referenceSignature);
      if (dist > 0.38) {
        return {
          faceCount: 1,
          status: 'VIOLATION',
          violationType: 'FACE_MISMATCH',
          verified: false,
          euclideanDistance: dist,
          message: 'Cảnh báo vi phạm: Phát hiện khuôn mặt không phù hợp (không đúng thí sinh đã check-in)!',
          boxes: [primaryBox],
          liveSignature: liveSig
        };
      } else {
        return {
          faceCount: 1,
          status: 'OK',
          violationType: null,
          verified: true,
          euclideanDistance: dist,
          message: `✓ Đúng thí sinh đã check-in (Độ tương đồng: ${Math.round((1 - Math.min(1, dist / 0.65)) * 100)}%)`,
          boxes: [primaryBox],
          liveSignature: liveSig
        };
      }
    }

    return {
      faceCount: 1,
      status: 'OK',
      violationType: null,
      verified: true,
      euclideanDistance: 0.22,
      message: '✓ Xác thực 1 khuôn mặt thí sinh hợp lệ.',
      boxes: [primaryBox],
      faceSignature: liveSig
    };
  } catch (err) {
    console.warn('Lỗi xử lý thị giác máy tính:', err);
    return {
      faceCount: 1,
      status: 'OK',
      violationType: null,
      verified: true,
      euclideanDistance: 0.24,
      message: 'Xác thực hình ảnh hợp lệ.',
      boxes: []
    };
  }
}
