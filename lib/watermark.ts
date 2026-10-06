/**
 * Motor de Aplicação de Marca d'Água em Imagens no Navegador (HTML5 Canvas)
 * Desenvolvido exatamente conforme a identidade visual oficial Chiarelli Imóveis:
 * Texto limpo, sem caixa escura e sem ícone, aplicado diretamente sobre a foto:
 * 
 *       Chiarelli
 *        IMÓVEIS
 * 
 * Letras brancas translúcidas com sombreamento suave para contraste perfeito
 * tanto em áreas claras (paredes brancas, céu) quanto em áreas escuras (telhados, folhagens).
 */

export interface WatermarkOptions {
  companyName?: string;
  subtitle?: string;
  position?: 'center' | 'bottom-right' | 'bottom-left' | 'top-right';
  opacity?: number;
}

/**
 * Desenha a marca d'água Chiarelli Imóveis no Canvas.
 */
function drawChiarelliWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: WatermarkOptions = {}
) {
  const {
    companyName = 'Chiarelli',
    subtitle = 'IMÓVEIS',
    position = 'center',
    opacity = 0.82
  } = options;

  const minDim = Math.min(width, height);
  // Escala dinâmica proporcional à resolução original da foto
  const scale = Math.max(0.65, minDim / 800);

  // Proporções tipográficas baseadas na imagem de referência
  const titleFontSize = Math.round(54 * scale);
  const subFontSize = Math.round(20 * scale);
  const lineGap = Math.round(12 * scale);

  ctx.save();
  ctx.globalAlpha = opacity;

  // Sombreamento sutil para garantir legibilidade sobre qualquer plano de fundo
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = Math.round(6 * scale);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.round(2 * scale);

  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Ponto central padrão
  let centerX = width / 2;
  let centerY = height / 2;

  if (position === 'bottom-right') {
    centerX = width - Math.round(160 * scale);
    centerY = height - Math.round(90 * scale);
  } else if (position === 'bottom-left') {
    centerX = Math.round(160 * scale);
    centerY = height - Math.round(90 * scale);
  } else if (position === 'top-right') {
    centerX = width - Math.round(160 * scale);
    centerY = Math.round(90 * scale);
  }

  // 1. Linha principal: "Chiarelli" (peso 700 / Bold, primeira letra maiúscula)
  ctx.font = `bold ${titleFontSize}px ${fontFamily}`;
  const titleY = centerY - Math.round((subFontSize + lineGap) / 2);
  ctx.fillText(companyName, centerX, titleY);

  // 2. Linha secundária: "IMÓVEIS" (caixa alta com espaçamento elegante entre caracteres)
  ctx.font = `bold ${subFontSize}px ${fontFamily}`;
  const subY = titleY + Math.round(titleFontSize * 0.6) + lineGap;

  // Aplica espaçamento uniforme (tracking) nas letras de IMÓVEIS
  const subUpper = subtitle.toUpperCase();
  if ('letterSpacing' in ctx) {
    (ctx as any).letterSpacing = `${Math.round(5 * scale)}px`;
    ctx.fillText(subUpper, centerX, subY);
  } else {
    // Fallback para navegadores sem letterSpacing nativo no canvas
    const spaced = subUpper.split('').join('  ');
    ctx.fillText(spaced, centerX, subY);
  }

  ctx.restore();
}

/**
 * Aplica a marca d'água na imagem via Canvas e retorna um novo File processado
 */
export async function applyWatermarkToImage(
  file: File,
  options: WatermarkOptions = {}
): Promise<File> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return file;
  }

  // Ignora arquivos que não são fotos (SVGs, GIFs)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  return new Promise<File>((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const width = img.naturalWidth || img.width;
            const height = img.naturalHeight || img.height;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(file);
              return;
            }

            // 1. Desenha a foto original com alta nitidez
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // 2. Aplica a marca d'água limpa Chiarelli Imóveis
            drawChiarelliWatermark(ctx, width, height, options);

            // 3. Exporta para blob/file com excelente qualidade (JPEG 92%)
            const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  resolve(file);
                  return;
                }

                const newFile = new File([blob], file.name, {
                  type: mimeType,
                  lastModified: Date.now(),
                });

                console.log(`[Watermark] Marca d'água Chiarelli aplicada em "${file.name}"`);
                resolve(newFile);
              },
              mimeType,
              0.92
            );
          } catch (canvasErr) {
            console.warn('[Watermark] Falha ao renderizar marca dágua:', canvasErr);
            resolve(file);
          }
        };

        img.onerror = () => resolve(file);

        if (typeof e.target?.result === 'string') {
          img.src = e.target.result;
        } else {
          resolve(file);
        }
      };

      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('[Watermark] Erro geral:', err);
      resolve(file);
    }
  });
}
