/**
 * astroide_mode.js - ElipseLab Pro
 * Envolvente de la vara: astroide |x|^(2/3)+|y|^(2/3) = L^(2/3)
 * Parametrización: x = L*cos^3(u), y = L*sin^3(u)
 */
(function () {
  if (!window.ElipseLab) return;

  ElipseLab.registerMode('astroide_envolvente', (ctx, state, helpers) => {
    const {
      viewport: vp, getColors, params,
      drawSegment, drawPoint, drawAxesExact, clamp01, drawCircleWorld, drawHandle, drawFoci
    } = helpers;

    const { a, b } = params();
    const col = getColors();
    const t = state.t || 0;
    const dpr = vp.dpr || 1;

    // --- Estilos y Configuración ---
    const vCol   = col.foci;
    const vAlpha = col.barAlpha    || 0.90;
    const vWidth = col.barWidth    || (2.5 * dpr);
    const jSize  = col.jointSize   || (3.5 * dpr);
    const gris   = col.faint       || '#888888';
    const aGris  = col.alphaTenue  || 0.3;
    const L      = a + b;

    // --- Cronograma de Animación ---
    const fMoveC1   = clamp01((t - 0.05) / 0.04);
    const fVaraFade = clamp01((t - 0.15) * 20);
    const fGiro     = clamp01((t - 0.25) / 0.75);
    const theta     = fGiro * Math.PI * 2;

    // --- Geometría de Referencia ---
    const H    = { x: L * Math.cos(theta), y: 0 };
    const V    = { x: 0,                   y: L * Math.sin(theta) };
    const P    = { x: a * Math.cos(theta), y: b * Math.sin(theta) };
    const midX = (H.x + V.x) / 2;
    const midY = (H.y + V.y) / 2;

    // Helper: Astroide Progresiva
    function drawAstroidPartial(ctx, L, uMax, color, width, alpha, vp) {
      if (alpha <= 0 || uMax <= 0) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = width;
      ctx.globalAlpha = alpha;
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath();
      for (let u = 0; u <= uMax + 0.01; u += 0.02) {
        const x = L * Math.pow(Math.cos(u), 3);
        const y = L * Math.pow(Math.sin(u), 3);
        u === 0 ? ctx.moveTo(vp.X(x), vp.Y(y)) : ctx.lineTo(vp.X(x), vp.Y(y));
      }
      ctx.stroke();
      ctx.restore();
    }

    // 0) Ejes y Handle
    const fAxesFade = 1 - clamp01(fGiro / 0.12);
    if (fAxesFade > 0) {
      const axAlpha = fAxesFade * (col.alphaTenue || 1.0);
      drawSegment(ctx, { x: -a, y: 0 }, { x: a, y: 0 }, col.axis, col.strokeFino, axAlpha, vp);
      drawSegment(ctx, { x: 0, y: -b }, { x: 0, y: b }, col.axis, col.strokeFino, axAlpha, vp);
    } else {
      drawAxesExact(ctx, a, b, vp);
    }
    drawHandle(ctx, a, 0, '#ff0000', 'h', 1, vp);

    if (state.showFoci) drawFoci(ctx, a, b, vp);

    // 1) Guías Principales (Cruces)
    if (fVaraFade > 0) {
      const alpha = fVaraFade * aGris;
      drawSegment(ctx, { x: -L, y: 0 }, { x: L, y: 0 }, gris, col.strokeFino, alpha, vp);
      drawSegment(ctx, { x: 0, y: -L }, { x: 0, y: L }, gris, col.strokeFino, alpha, vp);
    }

    // 1.b) Astroide
    if (fGiro > 0) {
      const astroAlpha = (col.alphaTenue || 0.3) * fVaraFade * (state.astroidAlphaScale ?? 1);
      drawAstroidPartial(ctx, L, theta, vCol, col.strokeFino, astroAlpha, vp);
    }

    // 2) Intro: Circunferencia de medida inicial
    const alphaC1 = aGris * (1 - fVaraFade);
    if (alphaC1 > 0) {
      const posX1 = a * fMoveC1;
      drawCircleWorld(ctx, posX1, 0, b, gris, col.strokeMedio, alphaC1, vp);
      if (fMoveC1 > 0.95) {
        drawPoint(ctx, a, 0, col.ellipse, jSize, true, alphaC1 * 2, vp);
        drawPoint(ctx, L, 0, vCol, jSize * 0.8, false, alphaC1 * 2, vp);
      }
    }

   // 3) Elementos Giratorios (Astroide -> Vara -> Centro)
    if (fGiro > 0) {
      const astroAlpha = (col.alphaTenue || 0.3) * fVaraFade;
      const curAlpha = fVaraFade * vAlpha; // Opacidad de la vara
      
      // Cálculo del punto de contacto M en la astroide y su normal B en la vara
      const Mx = L * Math.pow(Math.cos(theta), 3);
      const My = L * Math.pow(Math.sin(theta), 3);
      
      const segLen = Math.abs(L * Math.sin(theta) * Math.cos(theta));
      const angleVara = Math.atan2(V.y - H.y, V.x - H.x);
      const normalAngle = angleVara + (Math.sin(2 * theta) > 0 ? Math.PI / 2 : -Math.PI / 2);
      
      const B = { x: Mx + Math.cos(normalAngle) * segLen, y: My + Math.sin(normalAngle) * segLen };

      // Dibujo de Marcadores
      drawSegment(ctx, {x: Mx, y: My}, B, vCol, col.strokeFino, astroAlpha * 2, vp);

      // --- ESTE ES EL RADIO EXISTENTE QUE QUERÍAS CAMBIAR ---
      drawSegment(ctx, B, {x: midX, y: midY}, vCol, vWidth, curAlpha, vp);
      
      drawSegment(ctx, {x: Mx, y: My}, {x: midX, y: midY}, col.ellipse, col.strokeFino, astroAlpha, vp);
      drawPoint(ctx, Mx, My, vCol, jSize * 0.6, false, astroAlpha * 2, vp);
    }

    // 4) Vara y Elipse
    if (fVaraFade > 0) {
      const curAlpha = fVaraFade * vAlpha;
      if (fGiro > 0) {
        drawCircleWorld(ctx, midX, midY, L/2, gris, col.strokeMedio, curAlpha, vp);
        drawSegment(ctx, H, V, col.barColor, vWidth, curAlpha, vp);
        drawPoint(ctx, H.x, H.y, col.barColor, jSize, false, fVaraFade, vp);
        drawPoint(ctx, V.x, V.y, col.barColor, jSize, false, fVaraFade, vp);
        drawPoint(ctx, midX, midY, col.ellipse, jSize * 1.3, true, curAlpha, vp);

        // Trazo de Elipse progresiva
        ctx.save();
        ctx.strokeStyle = col.ellipse;
        ctx.lineWidth = col.strokeGrueso;
        ctx.beginPath();
        for (let u = 0; u <= theta + 0.02; u += 0.02) {
          ctx[u === 0 ? 'moveTo' : 'lineTo'](vp.X(a * Math.cos(u)), vp.Y(b * Math.sin(u)));
        }
        ctx.stroke();
        ctx.restore();
        drawPoint(ctx, P.x, P.y, col.ellipse, jSize * 1.5, true, 1, vp);
      } else {
        drawSegment(ctx, { x: 0, y: 0 }, { x: L, y: 0 }, vCol, vWidth, curAlpha, vp);
      }
    }

    // 5) Cierre: Círculo Inscrito y Diagonales
    const fCircle = clamp01((fGiro - 0.98) / 0.02);
    if (fCircle > 0) {
      const dash = (state.dashPx || [6, 4]).map(v => v * dpr);
      const alpha = fCircle * (col.alphaFuerte || 0.9);
      
      ctx.save();
      ctx.setLineDash(dash);
      ctx.strokeStyle = col.ellipse;
      ctx.lineWidth = dpr;
      ctx.globalAlpha = alpha;
      
      // Circunferencia L/2
      ctx.beginPath();
      ctx.arc(vp.X(0), vp.Y(0), (L / 2) * vp.scale * vp.userZoom, 0, Math.PI * 2);
      ctx.stroke();

      // Diagonales hasta los hombros de la astroide
      const p = L * Math.pow(Math.cos(Math.PI/4), 3);
      drawSegment(ctx, { x: -p, y: -p }, { x: p, y: p }, gris, col.strokeFino, alpha * 0.8, vp);
      drawSegment(ctx, { x: -p, y: p }, { x: p, y: -p }, gris, col.strokeFino, alpha * 0.8, vp);
      ctx.restore();
    }
  });
})();