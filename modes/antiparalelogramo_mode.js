/**
 * Reglas del modo:
 *  - Solo usa draw(ctx, state, H). No toques DOM ni añadas eventos.
 *  - Dibuja en "mundo" (Y hacia arriba). Los helpers convierten a pantalla.
 *  - No uses internas (p.ej. H.viewport._xMin).
 *  - Ejes solo si state.showAxes === true, con H.drawAxesExact(...).
 * Helpers clave (ver modes/README.md):
 *  - H.params(), H.getColors(), H.drawAxesExact, H.drawSegment/Point/Ellipse/Foci/ArcWorld/Label...
 *  - H.viewport: X/Y/dpr/scale/zoom/pan (solo lectura)
 */
(function() {
  if (!window.ElipseLab) return;

  ElipseLab.registerMode('antiparalelogramo', (ctx, state, H) => {
    const {
      viewport: vp, getColors, params, clamp01,
      drawSegment, drawPoint, drawAxesExact, drawHandle, drawFoci
    } = H;

    const { a, b, c } = params();
    const col = getColors();
    const t = state.t || 0;

    // --- Constantes de escena ---
    const L  = 2 * a;                         // radio de circunferencias “focales”
    const F1 = { x: -c, y: 0 }, F2 = { x:  c, y: 0 }; // focos reales (destino geométrico)
    const S1 = { x: -a, y: 0 }, S2 = { x:  a, y: 0 }; // centros iniciales (vértices ±a)

    // ---------- Cronograma ----------
    const fFadeCircs = clamp01(t * 12.5);          // 0.00 → 0.08 : fade-in rápido
    const fFadePunto = clamp01((t - 0.08) * 12.5); // 0.08 → 0.16 : punto trazador
    const fFadeVaras = clamp01((t - 0.16) * 11);   // 0.16 → 0.25 : barras
    const fGiro      = clamp01((t - 0.25) / 0.75); // 0.25 → 1.00 : trazado elipse

    // Traslado rápido de los centros de las circunferencias: 0.08→0.23 aprox.
    const fMoveLin   = (t < 0.25) ? clamp01((t - 0.08) / 0.15) : 1;
    const easeOutC3  = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.pow(1 - u, 3));
    const fMove      = easeOutC3(fMoveLin);

    // Centros animados (mundo): ±a → ±c
    const C1 = { x: S1.x + (F1.x - S1.x) * fMove, y: 0 };
    const C2 = { x: S2.x + (F2.x - S2.x) * fMove, y: 0 };

    // --- GEOMETRÍA DEL MECANISMO ---
    const ang = fGiro * Math.PI * 2;
    const M   = { x: a * Math.cos(ang), y: b * Math.sin(ang) };

    const d1 = Math.hypot(M.x - F1.x, M.y - F1.y);
    const d2 = Math.hypot(M.x - F2.x, M.y - F2.y);

    const G1 = { x: F1.x + (L / (d1 || 1)) * (M.x - F1.x), y: F1.y + (L / (d1 || 1)) * (M.y - F1.y) };
    const G2 = { x: F2.x + (L / (d2 || 1)) * (M.x - F2.x), y: F2.y + (L / (d2 || 1)) * (M.y - F2.y) };

    // --- GLOW opcional (conservado) ---
    const distSup = Math.abs(fGiro - 0.0);
    const distMid = Math.abs(fGiro - 0.5);
    const distInf = Math.abs(fGiro - 1.0);
    const proximidad = Math.min(distSup, distMid, distInf);
    const glowFactor = Math.max(0, 1 - proximidad / 0.06);

    // --- Diámetros (mismo comportamiento que Fowler/Afinidad) ---
    const fDiamPreset   = (t < 0.25) ? (1 - t / 0.25) : 0;
    const wantUserDiams = (typeof state.showDiameters !== 'undefined')
      ? !!state.showDiameters
      : !!state.showAxes;
    const fDiams = Math.max(fDiamPreset, wantUserDiams ? 1 : 0);

    // --- Construcción auxiliar ---
    const fAuxIn    = (t < 0.25) ? clamp01((t - 0.04) / 0.04) : 0;
    const fAuxMove  = fMove; // sincronizado con el traslado de las circunferencias
    const fAuxOut   = (t < 0.25) ? clamp01(1 - (t - 0.23) / 0.02) : 0;
    const fAuxAlpha = (t < 0.25) ? (fAuxIn * fAuxOut) : 0;
    const AuxInner  = { x: 0, y: b * fAuxMove };
    const xRight    = a + (c - a) * fAuxMove;   // a → c
    const xLeft     = -a + (-c + a) * fAuxMove; // -a → -c
    const AuxRight  = { x: xRight, y: 0 };
    const AuxLeft   = { x: xLeft,  y: 0 };

    ctx.save();

    // 0) Ejes (si showAxes) y tirador rojo SIEMPRE visible
    if (state.showAxes && typeof drawAxesExact === 'function') {
      drawAxesExact(ctx, a, b, vp);
    }
    drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp); // tirador rojo siempre

    // 0.b) DIÁMETROS DE LA ELIPSE (mayor y menor)
    if (fDiams > 0) {
      const alpha   = fDiams * (col.alphaMedio || 0.6);
      const lw      = col.strokeFino || (1.2 * vp.dpr);
      const diamCol = col.circs || col.faint;
      drawSegment(ctx, { x: -a, y: 0 }, { x:  a, y: 0 }, diamCol, lw, alpha, vp); // mayor
      drawSegment(ctx, { x: 0, y: -b }, { x: 0, y:  b }, diamCol, lw, alpha, vp); // menor
    }

    // 0.c) CONSTRUCCIÓN AUXILIAR (morfing hacia FOCOS)
    if (fAuxAlpha > 0) {
      const auxCol = col.circs || col.faint;
      const lw     = (col.strokeFino || (1.2 * vp.dpr)) * 1.0;
      const alpha  = fAuxAlpha * (col.alphaMedio || 0.6);
      drawSegment(ctx, AuxInner, AuxRight, auxCol, lw, alpha, vp);
      drawSegment(ctx, AuxInner, AuxLeft,  auxCol, lw, alpha, vp);
      const pAlpha = alpha * 0.9;
      drawPoint(ctx, AuxInner.x, AuxInner.y, auxCol, col.jointSize * 0.9, true, pAlpha, vp);
      drawPoint(ctx, AuxRight.x, AuxRight.y, auxCol, col.jointSize * 0.8, true, pAlpha, vp);
      drawPoint(ctx, AuxLeft.x,  AuxLeft.y,  auxCol, col.jointSize * 0.8, true, pAlpha, vp);
    }

    // 1) CIRCUNFERENCIAS DIRECTORAS (presentación + traslado ±a→±c)
    if (fFadeCircs > 0) {
      ctx.save();
      ctx.lineWidth   = col.strokeFino;
      ctx.strokeStyle = col.foci;
      ctx.globalAlpha = fFadeCircs * (col.alphaTenue || 0.35);
      const s = vp.scale * vp.userZoom;
      ctx.beginPath(); ctx.arc(vp.X(C1.x), vp.Y(C1.y), L * s, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(vp.X(C2.x), vp.Y(C2.y), L * s, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // 2) TRAZADO DE LA ELIPSE (protagonista)
    if (fGiro > 0) {
      ctx.save();
      ctx.strokeStyle = col.ellipse;
      ctx.lineWidth   = col.strokeGrueso;
      ctx.lineCap     = "round";
      ctx.beginPath();
      for (let i = 0; i <= fGiro + 0.005; i += 0.01) {
        const u  = i * Math.PI * 2;
        const px = a * Math.cos(u), py = b * Math.sin(u);
        if (i === 0) ctx.moveTo(vp.X(px), vp.Y(py));
        else          ctx.lineTo(vp.X(px), vp.Y(py));
      }
      ctx.stroke();
      ctx.restore();
    }

    // 3) MECANISMO (barras estándar del core)
    if (fFadeVaras > 0) {
      const vAlpha = fFadeVaras * (col.barAlpha || 0.9);
      // Bancada fija (entre focos reales)
      drawSegment(ctx, F1, F2, col.barColor, col.barWidth, vAlpha, vp);
      // Lados móviles
      drawSegment(ctx, F1, G1, col.barColor, col.barWidth, vAlpha, vp);
      drawSegment(ctx, F2, G2, col.barColor, col.barWidth, vAlpha, vp);
      drawSegment(ctx, G1, G2, col.barColor, col.barWidth, vAlpha, vp);
      // Articulaciones:
      // - Fijas (F1,F2): ANILLO (sin relleno) para que no dejen “tapón” blanco debajo.
      // - Móviles (G1,G2): como siempre, sólidas.
      [F1, F2].forEach(p => {
        drawPoint(ctx, p.x, p.y, col.barColor, col.jointSize, /*filled=*/false, vAlpha, vp);
      });
      [G1, G2].forEach(p => {
        drawPoint(ctx, p.x, p.y, col.barColor, col.jointSize, /*filled=*/true,  vAlpha, vp);
      });
    }

    // 4) PUNTO TRAZADOR + glow (si procede)
    if (fFadePunto > 0) {
      const baseSize = col.jointSize * 1.4;
      if (glowFactor > 0 && fGiro > 0) {
        ctx.save();
        ctx.shadowBlur  = 15 * glowFactor * (vp.dpr || 1);
        ctx.shadowColor = col.ellipse;
        drawPoint(ctx, M.x, M.y, col.ellipse, baseSize, true, fFadePunto, vp);
        ctx.restore();
      } else {
        drawPoint(ctx, M.x, M.y, col.ellipse, baseSize * 0.9, true, fFadePunto, vp);
      }
    }

    // 5) FOCOS POR ENCIMA DE TODO — usar el MISMO helper que en "afinidad"
    //    Dibujar al final garantiza el z-order y conserva el acabado azul sólido
    //    que ya te funciona en ese modo.
    drawFoci(ctx, a, b, vp);

    ctx.restore();
  });
})();