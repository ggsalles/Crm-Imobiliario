/**
 * Utilitário de compressão e otimização de imagens no navegador.
 * Reduz fotos de câmeras móveis (5MB-15MB) para ~200KB-600KB em WebP/JPEG
 * mantendo alta fidelidade visual (Full HD 1920px).
 */
export async function optimizeImageForUpload(
  file: File,
  maxDimension = 1920,
  quality = 0.85
): Promise<File> {
  // Apenas otimiza se estiver no navegador e for uma imagem rasterizada (ignora SVG e GIFs animados)
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return file;
  }

  // Não comprime SVGs ou GIFs para preservar transparência vetorial e animações
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  // Se o arquivo já for muito pequeno (< 200KB), não precisa recomprimir
  if (file.size < 200 * 1024) {
    return file;
  }

  return new Promise<File>((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;

            // Se a imagem exceder a dimensão máxima (Full HD), escala proporcionalmente
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(file); // Fallback caso não consiga criar contexto 2D
              return;
            }

            // Renderiza com interpolação suave
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // Tenta exportar preferencialmente em WebP
            canvas.toBlob(
              (blob) => {
                if (!blob || blob.size >= file.size) {
                  // Se o arquivo comprimido ficou maior que o original, mantém o original
                  resolve(file);
                  return;
                }

                const newFileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
                const optimizedFile = new File([blob], newFileName, {
                  type: 'image/webp',
                  lastModified: Date.now(),
                });

                console.log(
                  `[ImageOptimizer] Otimizado: "${file.name}" (${(file.size / 1024).toFixed(0)}KB) -> "${optimizedFile.name}" (${(optimizedFile.size / 1024).toFixed(0)}KB)`
                );
                resolve(optimizedFile);
              },
              'image/webp',
              quality
            );
          } catch (canvasErr) {
            console.warn('[ImageOptimizer] Falha ao processar canvas, usando arquivo original:', canvasErr);
            resolve(file);
          }
        };

        img.onerror = () => {
          resolve(file);
        };

        if (typeof e.target?.result === 'string') {
          img.src = e.target.result;
        } else {
          resolve(file);
        }
      };

      reader.onerror = () => {
        resolve(file);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('[ImageOptimizer] Exceção na compressão de imagem, mantendo original:', err);
      resolve(file);
    }
  });
}
