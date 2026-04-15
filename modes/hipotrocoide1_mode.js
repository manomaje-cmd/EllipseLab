(function() {
  if (!window.ElipseLab) return;

  ElipseLab.registerMode('hipotrocoide1', (ctx, state, helpers) => {
    const { 
      viewport: vp, getColors, params, 
      drawPoint, drawSegment, clamp01, drawAxesExact, drawFoci,
      drawHandle
    } = helpers;

    const { a, b } = params();
    const col = getColors();
    const t = state.t || 0;

    // ➟ En este modo SE DESACTIVAN los rastros (y se oculta el botón en index).
    const showTrails = false;
    const showFoci   = (state.showFoci === true);

    // --- CRONOGRAMA ---
    const fRodanteFade = clamp01((t - 0.08) * 12.5); // 0.08 → 0.16
    const fPuntoFade   = clamp01((t - 0.16) * 11);   // 0.16 → 0.25
    const fGiro        = clamp01((t - 0.25) / 0.75);
    const theta        = fGiro * Math.PI * 2;

    // --- GEOMETRÍA DEL MECANISMO ---
    // R (fijo) = a + b; r (rodante) = (a + b)/2; d = (a - b)/2
    const R_fijo  = a + b;
    const r_movil = (a + b) / 2;
    const distP   = (a - b) / 2;

    const centroM = { x: r_movil * Math.cos(theta), y: r_movil * Math.sin(theta) };
    // En una hipotrocoide, el punto gira en sentido opuesto al centro
    const P = { x: centroM.x + distP * Math.cos(-theta), y: centroM.y + distP * Math.sin(-theta) };

    // ─────────────────────────────────────────────────────
    // 0) DIÁMETROS/EJES: fade-out rápido en 0.25t; luego botón "Diámetros"
    // ─────────────────────────────────────────────────────
    {
      const fAxesIntro = 1 - clamp01(t / 0.25);
      if (fAxesIntro > 0) {
        const axAlpha = fAxesIntro * (col.alphaTenue || 1.0);
        drawSegment(ctx, { x: -a, y:  0 }, { x:  a, y:  0 }, col.axis,  col.strokeFino, axAlpha, vp);
        drawSegment(ctx, { x:  0, y: -b }, { x:  0, y:  b }, col.axis,  col.strokeFino, axAlpha, vp);
      } else if (state.showAxes) {
        // Si el usuario activa ejes, estos se dibujan con su grosor y
        // drawAxesExact incluye el TIRADOR estándar de 'a'
        drawAxesExact(ctx, a, b, vp);
      }
    }

    // ─────────────────────────────────────────────────────
    // 0.b) FOCOS: a discreción con el botón "Focos"
    // ─────────────────────────────────────────────────────
    if (showFoci) {
      drawFoci(ctx, a, b, vp);
    }

    // --- CRONOGRAMA INTRO ---
    // t: 0→0.04   — círculo radio b se traslada de 0 a (a, 0)
    // t: 0.04→0.10 — círculo b fade out, rodante y grande fade in simultáneos
    const fBMove    = clamp01(t / 0.04);
    const fBFadeOut = 1 - clamp01((t - 0.04) / 0.06);
    const fOtherIn  = clamp01((t - 0.04) / 0.06);

    // 1a) CÍRCULO DE RADIO b — se traslada hasta (a,0) y luego desaparece
    if (fBFadeOut > 0) {
      ctx.save();
      ctx.lineWidth   = col.strokeFino;
      ctx.strokeStyle = col.circs;
      ctx.globalAlpha = fBFadeOut * (col.alphaTenue ?? 0.5);
      ctx.beginPath();
      ctx.arc(vp.X(a * fBMove), vp.Y(0), Math.abs(b) * vp.scale * vp.userZoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 1b) CIRCUNFERENCIA GRANDE (R = a+b) + SUS DIÁMETROS (fade‑in simultáneo)
    if (fOtherIn > 0) {
      const alphaBig = fOtherIn * (col.alphaTenue ?? 0.5);

      // Circunferencia grande
      ctx.save();
      ctx.lineWidth   = col.strokeFino;
      ctx.strokeStyle = col.circs;
      ctx.globalAlpha = alphaBig;
      ctx.beginPath();
      ctx.arc(vp.X(0), vp.Y(0), Math.abs(R_fijo) * vp.scale * vp.userZoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Diámetros horizontal y vertical con el MISMO estilo y alpha
      drawSegment(ctx, { x: -R_fijo, y: 0 }, { x:  R_fijo, y: 0 }, col.circs, col.strokeFino, alphaBig, vp);
      drawSegment(ctx, { x: 0, y: -R_fijo }, { x: 0, y:  R_fijo }, col.circs, col.strokeFino, alphaBig, vp);
    }

    // 2) TRAZADO DE LA ELIPSE (Tusi)
    if (fGiro > 0) {
      ctx.save();
      ctx.strokeStyle = col.ellipse;
      ctx.lineWidth   = col.strokeGrueso;
      ctx.lineCap     = "round";
      ctx.lineJoin    = "round";
      ctx.beginPath();
      const uMax = fGiro * Math.PI * 2;
      for (let u = 0; u <= uMax + 1e-9; u += 0.01) {
        const px = r_movil * Math.cos(u) + distP * Math.cos(-u);
        const py = r_movil * Math.sin(u) + distP * Math.sin(-u);
        if (u === 0) ctx.moveTo(vp.X(px), vp.Y(py)); else ctx.lineTo(vp.X(px), vp.Y(py));
      }
      ctx.stroke();
      ctx.restore();
    }

    // 3) CIRCUNFERENCIA RODANTE y CENTRO — estilo "circs"
    if (fRodanteFade > 0) {
      ctx.save();
      ctx.lineWidth   = col.strokeFino;
      ctx.strokeStyle = col.circs;
      ctx.globalAlpha = fRodanteFade * (col.alphaMedio ?? 0.6);
      ctx.beginPath();
      ctx.arc(vp.X(centroM.x), vp.Y(centroM.y), Math.abs(r_movil) * vp.scale * vp.userZoom, 0, Math.PI * 2);
      ctx.stroke();
      drawPoint(ctx, centroM.x, centroM.y, col.circs, col.jointSize, /*filled=*/false, fRodanteFade, vp);
      ctx.restore();
    }

    // 4) DIÁMETRO de la rodante alineado con M→P + proyecciones a la circunferencia grande
    if (fPuntoFade > 0) {
      // Dirección del “radio pequeñito” (M→P)
      const dx = P.x - centroM.x, dy = P.y - centroM.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;

      // Extremos del DIÁMETRO completo de la rodante en esa dirección
      const E1 = { x: centroM.x + r_movil * ux, y: centroM.y + r_movil * uy };   // extremo “+”
      const E2 = { x: centroM.x - r_movil * ux, y: centroM.y - r_movil * uy };   // extremo “−”

      // Diámetro rodante (estilo rodante)
      drawSegment(ctx, E2, E1, col.circs, col.strokeFino, fPuntoFade * (col.alphaMedio ?? 0.6), vp);

      // Circulito pequeño (distP) centrado en M — estilo rodante
      if (distP > 0) {
        ctx.save();
        ctx.lineWidth   = col.strokeFino;
        ctx.strokeStyle = col.circs;
        ctx.globalAlpha = fPuntoFade * (col.alphaMedio ?? 0.6);
        ctx.beginPath();
        ctx.arc(vp.X(centroM.x), vp.Y(centroM.y), Math.abs(distP) * vp.scale * vp.userZoom, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // “Bolitas” en los extremos del diámetro (anillos del mismo color)
      drawPoint(ctx, E1.x, E1.y, col.circs, col.jointSize, /*filled=*/false, fPuntoFade, vp);
      drawPoint(ctx, E2.x, E2.y, col.circs, col.jointSize, /*filled=*/false, fPuntoFade, vp);

      // PROYECCIONES: extremos recorren los diámetros H y V de la circunferencia grande
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      const H = { x: clamp(E1.x, -R_fijo, R_fijo), y: 0 };
      const V = { x: 0, y: clamp(E2.y, -R_fijo, R_fijo) };

      // Guías tenues desde cada extremo hasta su proyección
      const guideAlpha = fPuntoFade * (col.alphaMedio ?? 0.6);
      drawSegment(ctx, E1, H, col.faint, col.strokeFino, guideAlpha, vp);
      drawSegment(ctx, E2, V, col.faint, col.strokeFino, guideAlpha, vp);

      // Punto trazador (referencia del trazo de la elipse)
      const pSize = col.jointSize * 1.5;
      drawPoint(ctx, P.x, P.y, col.ellipse, pSize, fGiro > 0, fPuntoFade, vp);
    }

    // 5) (Rastro determinista deshabilitado en este modo)
    // — intencionadamente sin implementación —

    // 6) TIRADOR estándar de 'a' — SIEMPRE visible aunque se desvanezcan ejes
    //    Evitamos duplicado cuando state.showAxes === true, ya que drawAxesExact lo pinta.
    if (!state.showAxes) {
      drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp);
    }
  });
})();