/**
 * Motor de Aplicação de Marca d'Água em Imagens no Navegador (HTML5 Canvas)
 * Desenvolvido especialmente para imobiliárias e corretores.
 * Aplica o badge oficial da marca (ex: Chiarelli Imóveis) com alta definição.
 */

export interface WatermarkOptions {
  companyName?: string;
  subtitle?: string;
  position?: 'center' | 'bottom-right' | 'bottom-left' | 'top-right';
  opacity?: number;
  badgeColor?: string; // Cor de fundo do badge (ex: '#1e3a8a' ou '#0f172a')
  accentColor?: string; // Cor de destaque (ex: '#38bdf8')
  creci?: string;
}

/**
 * Desenha o logotipo estilizado da imobiliária (Prédio / Edifício moderno em vetor no Canvas)
 */
function drawBuildingIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  accentColor: string
) {
  ctx.save();
  ctx.translate(x, y);

  const scale = size / 40;
  ctx.scale(scale, scale);

  // Telhado / Formas geométricas modernas de edifício
  ctx.strokeStyle = accentColor;
  ctx.fillStyle = accentColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Base do prisma do prédio
  ctx.beginPath();
  ctx.moveTo(20, 2);
  ctx.lineTo(36, 12);
  ctx.lineTo(20, 22);
  ctx.lineTo(4, 12);
  ctx.closePath();
  ctx.stroke();

  // Linhas verticais do prédio (efeito 3D de colunas)
  ctx.beginPath();
  ctx.moveTo(4, 12);
  ctx.lineTo(4, 28);
  ctx.lineTo(20, 38);
  ctx.lineTo(36, 28);
  ctx.lineTo(36, 12);
  ctx.stroke();

  // Colunas internas verticais
  ctx.beginPath();
  ctx.moveTo(12, 17);
  ctx.lineTo(12, 33);
  ctx.moveTo(20, 22);
  ctx.lineTo(20, 38);
  ctx.moveTo(28, 17);
  ctx.lineTo(28, 33);
  ctx.stroke();

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

  // Ignora SVGs e GIFs
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  const {
    companyName = 'Chiarelli',
    subtitle = 'IMÓVEIS',
    position = 'center',
    opacity = 0.92,
    badgeColor = 'rgba(15, 23, 42, 0.88)', // Slate 900 com transparência elegante
    accentColor = '#0284c7', // Azul ciano vibrante
    creci = ''
  } = options;

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

            // 1. Desenha a foto base
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // 2. Calcula proporções responsivas da marca d'água de acordo com a resolução da foto
            const minDimension = Math.min(width, height);
            const scaleFactor = Math.max(0.6, minDimension / 900);

            // Tamanhos calculados
            const titleFontSize = Math.round(26 * scaleFactor);
            const subFontSize = Math.round(13 * scaleFactor);
            const iconSize = Math.round(36 * scaleFactor);
            const paddingX = Math.round(24 * scaleFactor);
            const paddingY = Math.round(16 * scaleFactor);
            const gap = Math.round(14 * scaleFactor);
            const borderRadius = Math.round(18 * scaleFactor);

            // Medir largura do texto
            ctx.font = `bold ${titleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            const titleMetrics = ctx.measureText(companyName);
            
            ctx.font = `900 ${subFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            const subText = creci ? `${subtitle} • ${creci}` : subtitle;
            const subMetrics = ctx.measureText(subText);

            const textWidth = Math.max(titleMetrics.width, subMetrics.width);
            const badgeWidth = iconSize + gap + textWidth + paddingX * 2;
            const badgeHeight = Math.max(iconSize, titleFontSize + subFontSize + 6) + paddingY * 2;

            // 3. Determinar posição
            let badgeX = (width - badgeWidth) / 2;
            let badgeY = (height - badgeHeight) / 2;

            const margin = Math.round(30 * scaleFactor);
            if (position === 'bottom-right') {
              badgeX = width - badgeWidth - margin;
              badgeY = height - badgeHeight - margin;
            } else if (position === 'bottom-left') {
              badgeX = margin;
              badgeY = height - badgeHeight - margin;
            } else if (position === 'top-right') {
              badgeX = width - badgeWidth - margin;
              badgeY = margin;
            }

            // 4. Desenhar o badge com sombra e cantos arredondados
            ctx.save();
            ctx.globalAlpha = opacity;

            // Sombra suave do badge
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = Math.round(16 * scaleFactor);
            ctx.shadowOffsetY = Math.round(6 * scaleFactor);

            // Fundo do Badge
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, borderRadius);
            ctx.fillStyle = badgeColor;
            ctx.fill();

            // Borda refinada com gradiente suave
            ctx.shadowColor = 'transparent';
            ctx.lineWidth = Math.max(1.5, Math.round(2 * scaleFactor));
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.stroke();

            // 5. Desenhar o Ícone
            const iconX = badgeX + paddingX;
            const iconY = badgeY + (badgeHeight - iconSize) / 2;
            drawBuildingIcon(ctx, iconX, iconY, iconSize, accentColor);

            // 6. Desenhar Textos
            const textStartX = iconX + iconSize + gap;
            const titleY = badgeY + paddingY + titleFontSize * 0.85;

            // Título principal (Nome da Empresa, ex: "Chiarelli")
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${titleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.fillText(companyName, textStartX, titleY);

            // Subtítulo (ex: "IMÓVEIS")
            const subY = titleY + subFontSize + Math.round(6 * scaleFactor);
            ctx.fillStyle = accentColor;
            ctx.font = `900 ${subFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.letterSpacing = '2px';
            ctx.fillText(subText, textStartX, subY);

            ctx.restore();

            // 7. Exportar Canvas para novo File
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

                console.log(`[Watermark] Marca d'água aplicada com sucesso em "${file.name}" (${companyName})`);
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
