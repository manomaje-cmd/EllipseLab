/**
 * Modo: isoperimetrica
 * Familia de elipses con el mismo perímetro que la elipse canónica,
 * con excentricidad distribuida uniformemente de 0 (círculo) al máximo posible.
 * El slider de espaciado (state.spacing) controla el número de elipses mostradas.
 */
(function () {
  if (!window.ElipseLab) return;

  ElipseLab.registerMode('isoperimetrica', (ctx, state, helpers) => {
    const {
      viewport: vp, getColors, params,
      drawSegment, drawPoint, drawAxesExact,
      drawHandle, drawFoci
    } = helpers;

    const col    = getColors();
    const { a, b } = params();
    // Este modo no usa el slider de progreso (ocultado en index.html).

    // ── Ejes ──────────────────────────────────────────────────────────────────
    if (state.showAxes) drawAxesExact(ctx, a, b, vp);
    drawHandle(ctx, a, 0, '#ff0000', 'h', 1, vp);

    // ── Aproximación de Ramanujan para el perímetro ───────────────────────────
    function perimetroRamanujan(sA, sB) {
      const h = Math.pow((sA - sB) / (sA + sB), 2);
      return Math.PI * (sA + sB) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
    }

    // ── Dado perímetro P y excentricidad e, encuentra 'a' por bisección ───────
    function encontrarA(P, e, aMin, aMax) {
      const sqrtFactor = Math.sqrt(Math.max(0, 1 - e * e));
      for (let i = 0; i < 60; i++) {
        const aMid = (aMin + aMax) / 2;
        const bMid = aMid * sqrtFactor;
        if (perimetroRamanujan(aMid, bMid) < P) aMin = aMid;
        else aMax = aMid;
      }
      return (aMin + aMax) / 2;
    }

    // ── Perímetro de la elipse canónica ───────────────────────────────────────
    const P0 = perimetroRamanujan(a, b);

    // ── Excentricidad canónica ────────────────────────────────────────────────
    const e0 = Math.sqrt(Math.max(0, 1 - (b * b) / (a * a)));

    // ── Excentricidad máxima: la elipse más alargada con perímetro P0 ─────────
    // Una elipse con e→1 tiene perímetro ≈ 4a, así que a_max ≈ P0/4.
    // Buscamos e_max tal que la elipse sea visualmente significativa.
    // Usamos e_max = 0.995 como tope práctico.
    const E_MAX = 0.999;

    // ── Número de elipses según slider de espaciado ───────────────────────────
    const sRaw = state.spacing !== undefined ? state.spacing : 0.80;
    const minN = 3, maxN = 40, minS = 0.05, maxS = 2.50;
    const N = Math.round(maxN - ((sRaw - minS) / (maxS - minS)) * (maxN - minN));
    const nElipses = Math.max(minN, Math.min(maxN, N));

    // ── Construir la familia ──────────────────────────────────────────────────
    // Distribuimos excentricidades uniformemente de 0 a E_MAX,
    // excluyendo la canónica (se dibuja aparte en azul grueso).
    const familia = [];
    for (let i = 0; i <= nElipses; i++) {
      const e = (i / nElipses) * E_MAX;
      if (Math.abs(e - e0) < E_MAX / (2 * nElipses)) continue; // saltar la canónica
      const aF = encontrarA(P0, e, 0.01, P0 / Math.PI);
      const bF = aF * Math.sqrt(Math.max(0, 1 - e * e));
      if (aF > 0.001 && bF > 0.001) familia.push({ aF, bF, e, idx: i });
    }

    // ── Dibujar familia (gris tenue) + triángulo de excentricidad ────────────
    ctx.save();
    ctx.strokeStyle = col.faint || '#888';
    ctx.lineWidth   = col.strokeFino || (1 * (vp.dpr || 1));
    ctx.globalAlpha = 0.55;

    for (const { aF, bF, e, idx } of familia) {
      // Elipse
      ctx.beginPath();
      const pasos = 200;
      for (let i = 0; i <= pasos; i++) {
        const ang = (i / pasos) * Math.PI * 2;
        const px  = vp.X(aF * Math.cos(ang));
        const py  = vp.Y(bF * Math.sin(ang));
        if (i === 0) ctx.moveTo(px, py);
        else         ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Triángulo de proporción de excentricidad
      // Anclado en el vértice derecho de cada elipse (ángulo 0)
      const cF  = Math.sqrt(Math.max(0, aF * aF - bF * bF));
      const dXF = (cF > 1e-9) ? aF * aF / cF : 1e6; // directriz derecha
      const px0 = aF, py0 = 0;
      const d1  = aF - cF; // distancia focal en el vértice = a(1-e)

      // Omitir triángulo y etiqueta si la directriz se va demasiado lejos
      const limiteDirectriz = a * 80;
      if (dXF > limiteDirectriz) continue;

      // Directriz vertical discontinua (igual que Excentricidad 1)
      ctx.save();
      ctx.strokeStyle = col.faint || '#888';
      ctx.lineWidth   = col.strokeFino;
      ctx.globalAlpha = 0.8;
      ctx.setLineDash([4 * (vp.dpr || 1), 4 * (vp.dpr || 1)]);
      ctx.beginPath();
      const alzadoY = window.ElipseLab?.state?._dandelinAlzadoY ?? a * 5;
      ctx.moveTo(vp.X(dXF), vp.Y( alzadoY));
      ctx.lineTo(vp.X(dXF), vp.Y(-a * 2.2));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Cateto horizontal: del vértice a la directriz
      drawSegment(ctx,
        { x: px0, y: py0 }, { x: dXF, y: py0 },
        col.faint, col.strokeFino * 0.7, 0.4, vp
      );
      // Cateto vertical (hacia abajo)
      drawSegment(ctx,
        { x: dXF, y: py0 }, { x: dXF, y: py0 - d1 },
        col.faint, col.strokeFino * 0.7, 0.4, vp
      );
      // Hipotenusa (color de barra, tenue)
      drawSegment(ctx,
        { x: px0, y: py0 }, { x: dXF, y: py0 - d1 },
        col.barColor, col.strokeFino * 0.9, 0.35, vp
      );

      // Bolita en el vértice inferior del triángulo
      drawPoint(ctx, dXF, py0 - d1, col.barColor, 2.5 * (vp.dpr || 1), false, 0.5, vp);

      // Etiqueta de excentricidad en vertical, alineada desde el cateto horizontal hacia arriba
      const labelX  = vp.X(dXF) - 4 * (vp.dpr || 1);
      const labelY0 = vp.Y(py0); // nivel del cateto horizontal (eje X mundo = Y canvas)
      // Formato: ε = 0.964·idx/nElipses  (muestra el crecimiento uniforme)
      const etiqueta = idx === nElipses
        ? `ε = ${E_MAX.toFixed(3)}`
        : `ε = ${E_MAX.toFixed(3)}·${idx}/${nElipses}`;
      ctx.save();
      ctx.globalAlpha  = 0.6;
      ctx.fillStyle    = col.barColor || '#c2410c';
      ctx.font         = `${13 * (vp.dpr || 1)}px sans-serif`;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.translate(labelX, labelY0);
      ctx.scale(1, -1);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(etiqueta, 0, 0);
      ctx.restore();
    } // fin bucle familia
    ctx.restore();

    // ── Dibujar elipse canónica (azul gruesa, encima) ─────────────────────────
    ctx.save();
    ctx.strokeStyle = col.ellipse;
    ctx.lineWidth   = col.strokeGrueso || (2.8 * (vp.dpr || 1));
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    const pasos = 300;
    for (let i = 0; i <= pasos; i++) {
      const ang = (i / pasos) * Math.PI * 2;
      if (i === 0) ctx.moveTo(vp.X(a * Math.cos(ang)), vp.Y(b * Math.sin(ang)));
      else         ctx.lineTo(vp.X(a * Math.cos(ang)), vp.Y(b * Math.sin(ang)));
    }
    ctx.stroke();
    ctx.restore();

    // --- BLOQUE DE FOCOS ---
    if (state.showFoci) {
      drawFoci(ctx, a, b, vp);
    }
    // -----------------------

  });
})();