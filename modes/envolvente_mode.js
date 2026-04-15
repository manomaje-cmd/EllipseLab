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
(function () {
  if (!window.ElipseLab) return;

  ElipseLab.registerMode('envolvente', (ctx, state, helpers) => {
    const {
      viewport: vp, getColors, params, clamp01,
      drawSegment, drawPoint, drawAxesExact, drawHandle,
      drawArcWorld, drawCircleWorld
    } = helpers;

    const { a, b, c } = params();
    const col = getColors();
    const t = state.t || 0;

    const fTangentFade = clamp01((t - 0.16) * 11);
    const fGiro        = clamp01((t - 0.25) / 0.75);

    const ellipsePoint = (u) => ({ x: a * Math.cos(u), y: b * Math.sin(u) });
    const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

    // 1) Ejes / Tiradores + solo foco derecho
    if (state.showAxes) { drawAxesExact(ctx, a, b, vp); }
    else { drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp); }
    drawPoint(ctx, c, 0, col.foci, 4, false, col.alphaMedio, vp);

    // 2) Geometría activa
    const uAct = fGiro * Math.PI * 2;
    const pAct = ellipsePoint(uAct);
    const R = 2 * a;

    const dF1P = distance(pAct.x, pAct.y, -c, 0); // F1 = (-c,0)
    const N_act = { x: -c + (R / dF1P) * (pAct.x + c), y: (R / dF1P) * pAct.y };
    const M_act = { x: (N_act.x + c) / 2, y: N_act.y / 2 }; // |M| = a

    const drawHeight = (M, dx, dy, alpha, weight, color) => {
      const ox = M.x + c, oy = M.y; // respecto a F1
      const A = dx*dx + dy*dy;
      const B = 2*(ox*dx + oy*dy);
      const C = ox*ox + oy*oy - R*R;
      const disc = B*B - 4*A*C;
      if (disc >= 0) {
        const sD = Math.sqrt(disc);
        const k1 = (-B + sD) / (2 * A), k2 = (-B - sD) / (2 * A);
        drawSegment(ctx,
          { x: M.x + k1*dx, y: M.y + k1*dy },
          { x: M.x + k2*dx, y: M.y + k2*dy },
          color || col.faint, weight, alpha, vp
        );
      }
    };

    // 3) Rastro de la envolvente (familia de alturas)
    if (fGiro > 0 && state.showTrails) {
      const step = (state.spacing || 0.8) * 12;
      for (let deg = 0; deg <= fGiro * 360; deg += step) {
        const u = deg * Math.PI / 180;
        const p = ellipsePoint(u);
        const d = distance(p.x, p.y, -c, 0);
        const N = { x: -c + (R / d) * (p.x + c), y: (R / d) * p.y };
        const M = { x: (N.x + c) / 2, y: N.y / 2 };
        drawHeight(M, -N.y, N.x - c, col.traceAlpha, col.traceWidth, col.traceColor);
      }
    }

    // 4) Auxiliares instantáneos
    if (fTangentFade > 0) {
      drawSegment(ctx, { x: c, y: 0 }, N_act, col.faint, col.strokeFino, fTangentFade * col.alphaMedio, vp);
      drawSegment(ctx, pAct, N_act, col.faint, col.strokeFino, fTangentFade * col.alphaMedio, vp);
      drawHeight(M_act, -N_act.y, N_act.x - c, fTangentFade * col.alphaFuerte, col.strokeMedio, col.ellipse);
      drawPoint(ctx, M_act.x, M_act.y, col.ellipse, 3.5, false, fTangentFade, vp);
      drawPoint(ctx, pAct.x, pAct.y, col.ellipse, 5.0, (fGiro > 0), fTangentFade, vp);
    }

    // 5) Arco progresivo de la circunferencia principal (|M| = a), siguiendo a M
    if (fGiro > 0) {
      const p0 = ellipsePoint(0);
      const d0 = distance(p0.x, p0.y, -c, 0);
      const N0 = { x: -c + (R / d0) * (p0.x + c), y: (R / d0) * p0.y };
      const M0 = { x: (N0.x + c) / 2, y: N0.y / 2 };
      const theta0 = Math.atan2(M0.y, M0.x);

      const thetaNow = Math.atan2(M_act.y, M_act.x);
      const endTheta = (fGiro >= 0.999999) ? (theta0 + 2*Math.PI) : thetaNow;

      drawArcWorld(ctx, 0, 0, a, theta0, endTheta, {
        color: col.circs, width: col.strokeFino, alpha: col.alphaMedio, segments: 360
      }, vp);
    }

    // 6) DIRECTORA (circunferencia focal) — al final y encima
    drawCircleWorld(ctx, -c, 0, 2*a, col.foci, col.strokeFino * 1.15, col.alphaFuerte, vp);
  });
})();