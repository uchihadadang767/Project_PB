/**
 * Dithering and Image Processing for Thermal Direct Receipts
 * Implements Bayer 4x4 Ordered Dithering, High Contrast Halftone, Grayscale, and Inverted filters.
 */

const ThermalDither = {
  // Bayer 4x4 matrix normalized 0..255
  bayerMatrix4x4: [
    [  0, 128,  32, 160 ],
    [ 192,  64, 224,  96 ],
    [  48, 176,  16, 144 ],
    [ 240, 112, 208,  80 ]
  ],

  // Process ImageData in place according to the chosen filter
  applyFilter(ctx, width, height, filterType = 'dithered', intensityPercent = 100) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const factor = (intensityPercent / 100);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        let r = data[idx];
        let g = data[idx + 1];
        let b = data[idx + 2];

        // Convert to Luminance (grayscale)
        let lum = 0.299 * r + 0.587 * g + 0.114 * b;

        // Apply contrast adjustment
        lum = ((lum - 128) * (1.2 * factor)) + 128;
        lum = Math.max(0, Math.min(255, lum));

        let outVal = lum;

        if (filterType === 'dithered') {
          // Bayer 4x4 ordered dithering
          const threshold = this.bayerMatrix4x4[y % 4][x % 4];
          outVal = lum > threshold ? 255 : 0;
        } else if (filterType === 'halftone') {
          // Sharp binary threshold
          const threshold = 128 / factor;
          outVal = lum > threshold ? 255 : 0;
        } else if (filterType === 'grayscale') {
          // Smooth tonal monochrome
          outVal = lum;
        } else if (filterType === 'inverted') {
          // Inverted negative
          const threshold = this.bayerMatrix4x4[y % 4][x % 4];
          const invLum = 255 - lum;
          outVal = invLum > threshold ? 255 : 0;
        }

        data[idx] = outVal;
        data[idx + 1] = outVal;
        data[idx + 2] = outVal;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  },

  // Helper to process an Image / DataURL and return a new canvas / DataURL
  processImageSource(imageSrc, filterType, intensity = 100) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (imageSrc && !imageSrc.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 640;
        canvas.height = img.naturalHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        this.applyFilter(ctx, canvas.width, canvas.height, filterType, intensity);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        // Fallback placeholder canvas
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#eeeeea';
        ctx.fillRect(0, 0, 400, 300);
        ctx.fillStyle = '#121212';
        ctx.font = 'bold 20px "Space Mono", monospace';
        ctx.fillText('[ PHOTO SAMPLE ]', 100, 150);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = imageSrc;
    });
  }
};

window.ThermalDither = ThermalDither;
