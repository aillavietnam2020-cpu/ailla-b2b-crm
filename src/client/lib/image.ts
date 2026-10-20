/**
 * Thu nhỏ ảnh bill ngay trên trình duyệt trước khi gửi (ảnh chụp điện thoại thường 3-6 MB, máy chủ chỉ
 * nhận ≤ 1,5 MB). PDF và ảnh đã đủ nhỏ giữ nguyên.
 */
const MAX_BYTES = 1_400_000;

export async function shrinkImage(file: File, maxDim = 1800): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  if (file.size <= 600_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    let quality = 0.85;
    for (let i = 0; i < 5; i += 1) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && (blob.size <= MAX_BYTES || i === 4)) {
        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        return new File([blob], name, { type: 'image/jpeg' });
      }
      quality -= 0.15;
    }
    return file;
  } catch {
    return file;
  }
}
