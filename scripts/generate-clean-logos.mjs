import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Background unmatting function
async function unmatImage(inputPath, bgR = 245, bgG = 237, bgB = 219, thresholdLow = 12, thresholdHigh = 55) {
  const { data, info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const out = Buffer.alloc(w * h * 4);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

    let alpha = 0;
    let outR = r, outG = g, outB = b;

    if (dist <= thresholdLow) {
      alpha = 0;
      outR = 0; outG = 0; outB = 0;
    } else if (dist >= thresholdHigh) {
      alpha = 255;
    } else {
      const t = (dist - thresholdLow) / (thresholdHigh - thresholdLow);
      alpha = Math.round(t * 255);
      const a = alpha / 255;
      outR = Math.max(0, Math.min(255, Math.round((r - (1 - a) * bgR) / a)));
      outG = Math.max(0, Math.min(255, Math.round((g - (1 - a) * bgG) / a)));
      outB = Math.max(0, Math.min(255, Math.round((b - (1 - a) * bgB) / a)));
    }

    out[i] = outR;
    out[i + 1] = outG;
    out[i + 2] = outB;
    out[i + 3] = alpha;
  }

  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

// 32-bit DIB ICO builder for maximum browser & OS compatibility
function createDibIco(images) {
  // images: array of { width, height, rawBuffer (w*h*4 RGBA) }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(images.length, 4);

  const dibs = [];
  for (const img of images) {
    const { width: w, height: h, rawBuffer } = img;
    const bih = Buffer.alloc(40);
    bih.writeUInt32LE(40, 0); // biSize
    bih.writeInt32LE(w, 4);   // biWidth
    bih.writeInt32LE(h * 2, 8); // biHeight * 2 (XOR mask + AND mask)
    bih.writeUInt16LE(1, 12);  // biPlanes
    bih.writeUInt16LE(32, 14); // biBitCount (32-bit RGBA)
    bih.writeUInt32LE(0, 16);  // biCompression = BI_RGB
    bih.writeUInt32LE(w * h * 4, 20); // biSizeImage

    // XOR mask: bottom to top, BGRA order
    const xorMask = Buffer.alloc(w * h * 4);
    const andRowBytes = Math.ceil(w / 32) * 4;
    const andMask = Buffer.alloc(andRowBytes * h);

    for (let y = 0; y < h; y++) {
      const srcY = h - 1 - y; // flip vertically
      for (let x = 0; x < w; x++) {
        const srcIdx = (srcY * w + x) * 4;
        const dstIdx = (y * w + x) * 4;
        const r = rawBuffer[srcIdx];
        const g = rawBuffer[srcIdx + 1];
        const b = rawBuffer[srcIdx + 2];
        const a = rawBuffer[srcIdx + 3];

        xorMask[dstIdx] = b;
        xorMask[dstIdx + 1] = g;
        xorMask[dstIdx + 2] = r;
        xorMask[dstIdx + 3] = a;

        // 1-bit transparency mask for legacy decoders
        if (a < 128) {
          const byteIdx = y * andRowBytes + Math.floor(x / 8);
          const bitIdx = 7 - (x % 8);
          andMask[byteIdx] |= (1 << bitIdx);
        }
      }
    }

    const dib = Buffer.concat([bih, xorMask, andMask]);
    dibs.push(dib);
  }

  let offset = 6 + images.length * 16;
  const entries = [];
  for (let i = 0; i < images.length; i++) {
    const { width: w, height: h } = images[i];
    const dib = dibs[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(w === 256 ? 0 : w, 0);
    entry.writeUInt8(h === 256 ? 0 : h, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(dib.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += dib.length;
  }

  return Buffer.concat([header, ...entries, ...dibs]);
}

async function main() {
  const root = process.cwd();
  console.log('Generating clean transparent logo assets...');

  // 1. Un-mat spendsense-icon.png to create clean transparent icon
  // Note: public/spendsense-icon.png contains the full original green emblem with beige bg
  const cleanIconPng = await unmatImage(path.join(root, 'public/spendsense-icon.png'));
  fs.writeFileSync(path.join(root, 'public/spendsense-icon-transparent.png'), cleanIconPng);
  fs.writeFileSync(path.join(root, 'public/spendsense-icon.png'), cleanIconPng);
  console.log('✓ Updated public/spendsense-icon-transparent.png and public/spendsense-icon.png');

  // 2. Un-mat spendsense-logo.png to create clean transparent full logo
  const cleanLogoPng = await unmatImage(path.join(root, 'public/spendsense-logo.png'));
  fs.writeFileSync(path.join(root, 'public/spendsense-logo-transparent.png'), cleanLogoPng);
  fs.writeFileSync(path.join(root, 'public/spendsense-logo.png'), cleanLogoPng);
  console.log('✓ Updated public/spendsense-logo-transparent.png and public/spendsense-logo.png');

  // 3. Create high-resolution square transparent icon for favicon/tab/app
  // Trim empty transparent edges first to ensure exact centering
  const trimmedIconBuffer = await sharp(cleanIconPng).trim().toBuffer();
  
  // Make a centered 512x512 master icon with 8% padding
  const masterSize = 512;
  const innerSize = Math.round(masterSize * 0.84); // 84% fit gives optimal aesthetic balance
  const resizedInner = await sharp(trimmedIconBuffer)
    .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  
  const squareIcon512 = await sharp(resizedInner)
    .resize(masterSize, masterSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Save icon.png to src/app and public
  fs.writeFileSync(path.join(root, 'src/app/icon.png'), squareIcon512);
  fs.writeFileSync(path.join(root, 'public/icon.png'), squareIcon512);
  console.log('✓ Updated src/app/icon.png and public/icon.png (512x512 transparent)');

  // Save apple-icon.png (180x180)
  const appleIcon = await sharp(squareIcon512)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(root, 'src/app/apple-icon.png'), appleIcon);
  fs.writeFileSync(path.join(root, 'public/apple-icon.png'), appleIcon);
  console.log('✓ Created src/app/apple-icon.png and public/apple-icon.png (180x180 transparent)');

  // 4. Generate multi-resolution ICO file (48x48, 32x32, 16x16)
  const icoSizes = [48, 32, 16];
  const dibImages = [];

  for (const s of icoSizes) {
    const sInner = Math.round(s * 0.88);
    const sResized = await sharp(trimmedIconBuffer)
      .resize(sInner, sInner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    const { data } = await sharp(sResized)
      .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .raw()
      .toBuffer({ resolveWithObject: true });

    dibImages.push({ width: s, height: s, rawBuffer: data });
  }

  const icoBuffer = createDibIco(dibImages);
  fs.writeFileSync(path.join(root, 'src/app/favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(root, 'public/favicon.ico'), icoBuffer);
  console.log('✓ Created src/app/favicon.ico and public/favicon.ico (Multi-size DIB ICO, transparent)');

  console.log('All branding and icon assets generated successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
