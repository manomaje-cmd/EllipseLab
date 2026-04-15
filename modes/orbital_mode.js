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

  // --- 1) La función de dibujo del modo (tu contenido original) ---
  function drawOrbital(ctx, state, H) {
    const {
      viewport: vp, getColors, params,
      drawSegment, drawPoint, drawHandle, drawAxesExact, clamp01
    } = H;

    const { a, b, c } = params();
    const col = getColors();
    const t = Number(state.t || 0);

    // 0) Ejes a demanda y Tirador del core
    if (state.showAxes) {
      drawAxesExact(ctx, a, b, vp);
    }
    drawHandle(ctx, a, 0, '#ff0000', 'h', 1, vp);

    // 1) Cronograma
    const fFocalCircFade = clamp01((t - 0.08) * 12.5);
    const fTangentFade   = clamp01((t - 0.16) * 11);
    const fGiro          = clamp01((t - 0.25) / 0.75);

    // 2) Utilidades (E = anomalía excéntrica)
    const ellipsePoint      = (E) => ({ x: a * Math.cos(E), y: b * Math.sin(E) });
    const ellipseTangentVec = (E) => ({ dx: -a * Math.sin(E), dy:  b * Math.cos(E) });
    const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

    const worldToPx = (Lw) => Lw * vp.scale * vp.userZoom;
    const pxToWorld = (Lp) => Lp / (vp.scale * vp.userZoom);

    // 3) Foco atractor
    const attractorSide = (state.attractorSide === 'left' ? 'left' : 'right');
    const focusX = (attractorSide === 'right' ? +c : -c);
    if (state.showAttractorFocus !== false) {
      drawPoint(ctx, focusX, 0, col.foci, 4, false, 1.0, vp);
    }

    // 4) Circunferencia focal (directora): centro F1=-c, radio=2a
    if (fFocalCircFade > 0) {
      ctx.save();
      ctx.strokeStyle = col.foci;
      ctx.lineWidth   = col.strokeFino;
      ctx.globalAlpha = fFocalCircFade * (col.alphaTenue ?? 0.5);
      ctx.beginPath();
      ctx.arc(vp.X(-c), vp.Y(0), worldToPx(2 * a), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 5) Parámetros visuales
    const speedModel      = (state.speedModel     || 'kepler');    // 'kepler' | 'rigid'
    const velUnits        = (state.velUnits       || 'px');        // 'px' | 'world'
    const velScale        = (state.velScale       != null ? state.velScale : (velUnits === 'px' ? 8000 : 0.25));
    const minLenPx        = (state.minLenPx       != null ? state.minLenPx : 8);
    const maxLenPx        = (state.maxLenPx       != null ? state.maxLenPx : 800);
    const raiseTraceAlpha = (state.raiseTraceAlpha === true);
    const trailKeep       = (state.trailKeep      != null ? state.trailKeep : 1.0);

    const showGrav    = (state.showGrav !== false);
    const gravScalePx = (state.gravScalePx != null ? state.gravScalePx : 120000);
    const gravMinPx   = (state.gravMinPx   != null ? state.gravMinPx   : 10);
    const gravMaxPx   = (state.gravMaxPx   != null ? state.gravMaxPx   : 800);

    const showHodo       = (state.showHodo !== false);
    const hodoPadPx      = (state.hodoPadPx != null ? state.hodoPadPx : 140);
    const hodoAxis       = (state.hodoAxis  !== false);
    const hodoLinkScale  = (state.hodoLinkScale !== false);
    const hodoSign       = (state.hodoSign != null ? state.hodoSign : 1);
    const showHodoCircle = (state.showHodoCircle === true);
    const showHodoFamily = (state.showHodoFamily !== false);
    const hodoTrace      = (state.hodoTrace === true);

    const showAreaSector = (state.showAreaSector !== false);
    const e              = Math.abs(a > 1e-12 ? (c / a) : 0);
    const areaDeltaM     = (state.areaDeltaM != null
                          ? state.areaDeltaM
                          : (state.areaDeltaDeg != null ? state.areaDeltaDeg * Math.PI / 180 : 12 * Math.PI / 180));
    const areaSides      = (state.areaSides || 'both'); // 'both'|'forward'|'backward'
    const areaArcSteps   = Math.max(4, (state.areaArcSteps || 28));
    const areaOpposite   = (state.areaOpposite !== false);
    const areaMainColor  = state.areaMainColor  || col.ellipse;
    const areaOppColor   = state.areaOppColor   || '#06b6d4';

    // 6) Ley de áreas → longitud ∝ 1/r (o rígida)
    const baseFromR = (r) => (speedModel === 'rigid') ? r : 1 / Math.max(r, 1e-12);

    const lengthFinal = (r) => {
      if (velUnits === 'px') {
        let Lpx = velScale * baseFromR(r);
        Lpx = Math.max(minLenPx, Math.min(Lpx, maxLenPx));
        return pxToWorld(Lpx);
      }
      return velScale * baseFromR(r);
    };

    // 7) Flecha de velocidad en P
    const drawSpeedAtP = (P, E, alpha, weight, color) => {
      const tv = ellipseTangentVec(E);
      let tn = Math.hypot(tv.dx, tv.dy);
      if (tn < 1e-12) return null;

      let ux = tv.dx / tn, uy = tv.dy / tn;
      const sgn = (state.velFlip === true ? -1 : +1);
      ux *= sgn; uy *= sgn;

      const r  = dist(P.x, P.y, focusX, 0);
      const Lw = lengthFinal(r);
      if (!(Lw > 0)) return null;

      const Pend = { x: P.x + ux * Lw, y: P.y + uy * Lw };
      drawSegment(ctx, P, Pend, color || col.ellipse, weight, alpha, vp);

      const arrowPx = (state.arrowSizePx != null ? state.arrowSizePx : 8);
      const wingDeg = (state.arrowWingDeg != null ? state.arrowWingDeg : 15);
      const Lh      = pxToWorld(arrowPx);
      const ang = wingDeg * Math.PI / 180;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const pxv = -uy, pyv = ux;

      const ax1 = { x: Pend.x + Lh * (-ux * ca + pxv * sa), y: Pend.y + Lh * (-uy * ca + pyv * sa) };
      const ax2 = { x: Pend.x + Lh * (-ux * ca - pxv * sa), y: Pend.y + Lh * (-uy * ca - pyv * sa) };
      drawSegment(ctx, Pend, ax1, color || col.ellipse, weight, alpha, vp);
      drawSegment(ctx, Pend, ax2, color || col.ellipse, weight, alpha, vp);

      return Pend;
    };

    // 8) Instante actual (E0), normal de la focal y M,N
    const E0 = fGiro * Math.PI * 2;
    const P0 = ellipsePoint(E0);
    const R  = 2 * a;
    const dF1P = dist(P0.x, P0.y, -c, 0) || 1e-12;
    const N_act = { x: -c + (R / dF1P) * (P0.x + c), y: (R / dF1P) * P0.y };
    const M_act = { x: (N_act.x + c) / 2, y: N_act.y / 2 };

    // 9) Familia de flechas (rastro vectorial)
    if (fGiro > 0) {
      const step = (state.spacing || 0.8) * 12;
      const alphaTrace = (raiseTraceAlpha ? Math.min(0.22, (col.traceAlpha ?? 0.15) * 3) : (col.traceAlpha ?? 0.15));
      for (let deg = 0; deg <= fGiro * 360; deg += step) {
        const E = +deg * Math.PI / 180;
        drawSpeedAtP(ellipsePoint(E), E, alphaTrace, col.traceWidth, col.faint);
      }
    }

    // 10) Flecha activa + vector gravitatorio + cuerda
    let Pend = null;
    if (fTangentFade > 0) {
      // Cuerda punteada en circunferencia focal
      const drawDottedHeight = (M, dx, dy, alpha, weight, color) => {
        const ox = M.x + c, oy = M.y; // respecto a F1 (-c,0)
        const A = dx*dx + dy*dy;
        const B = 2*(ox*dx + oy*dy);
        const Cq = ox*ox + oy*oy - (4*a*a); // R = 2a
        const disc = B*B - 4*A*Cq;
        if (disc >= 0) {
          const sD = Math.sqrt(disc);
          const k1 = (-B + sD) / (2 * A), k2 = (-B - sD) / (2 * A);
          ctx.save();
          if (ctx.setLineDash) ctx.setLineDash([1, 2]);
          drawSegment(ctx,
            { x: M.x + k1*dx, y: M.y + k1*dy },
            { x: M.x + k2*dx, y: M.y + k2*dy },
            color || "#000000", weight, alpha, vp
          );
          ctx.restore();
        }
      };

      drawDottedHeight(M_act, -N_act.y, N_act.x - c, fTangentFade, col.strokeFino, "#000000");

      drawSegment(ctx, { x: c, y: 0 }, N_act, col.faint,  col.strokeFino, fTangentFade * (col.alphaTenue ?? 0.5), vp);
      drawSegment(ctx, P0,          N_act, col.faint,  col.strokeFino, fTangentFade * (col.alphaTenue ?? 0.5), vp);
      
      Pend = drawSpeedAtP(P0, E0, fTangentFade * (col.alphaFuerte ?? 1.0), col.strokeMedio, col.ellipse);

      if (showGrav) {
        const rx = focusX - P0.x, ry = -P0.y;
        const r = Math.hypot(rx, ry) || 1;
        const ux = rx / r, uy = ry / r;
        let Lpx = gravScalePx * (1 / (r * r));
        Lpx = Math.max(gravMinPx, Math.min(Lpx, gravMaxPx));
        const Lw = pxToWorld(Lpx);
        const Gend = { x: P0.x + ux * Lw, y: P0.y + uy * Lw };
        drawSegment(ctx, P0, Gend, col.foci, col.strokeGrueso, fTangentFade, vp);

        // punta
        const arrowPx = (state.arrowSizePx != null ? state.arrowSizePx : 10);
        const Lh = pxToWorld(arrowPx);
        const ang = 26 * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
        const ax1 = { x: Gend.x + Lh * (-ux * ca - uy * sa), y: Gend.y + Lh * (-uy * ca + ux * sa) };
        const ax2 = { x: Gend.x + Lh * (-ux * ca + uy * sa), y: Gend.y + Lh * (-uy * ca - ux * sa) };
        drawSegment(ctx, Gend, ax1, col.foci, col.strokeMedio, fTangentFade, vp);
        drawSegment(ctx, Gend, ax2, col.foci, col.strokeMedio, fTangentFade, vp);
      }

      drawPoint(ctx, M_act.x, M_act.y, col.ellipse, 3.5, false, fTangentFade, vp);
      drawPoint(ctx, P0.x,    P0.y,    col.ellipse, 5,    (fGiro > 0), fTangentFade, vp);
    }

    // 11) Hodógrafo
    (function HODOGRAFO() {
      if (!showHodo) return;

      const eabs = e;
      const rperi = a * (1 - eabs);
      const Lw_peri = lengthFinal(rperi);
      const k_world = (hodoLinkScale ? (Lw_peri / (1 + eabs)) : pxToWorld(60));
      const Cc = { x: a + pxToWorld(hodoPadPx) + k_world, y: 0 };
      const Hc = { x: Cc.x, y: -hodoSign * k_world * eabs };

      if (hodoAxis) {
        const ax = pxToWorld(6);
        drawSegment(ctx, { x: Hc.x - ax, y: Hc.y }, { x: Hc.x + ax, y: Hc.y }, col.faint, col.strokeFino, (col.alphaTenue ?? 0.5), vp);
        drawSegment(ctx, { x: Hc.x, y: Hc.y - ax }, { x: Hc.x, y: Hc.y + ax }, col.faint, col.strokeFino, (col.alphaTenue ?? 0.5), vp);
      }

      if (showHodoCircle) {
        ctx.save();
        ctx.strokeStyle = col.ellipse;
        ctx.lineWidth   = col.strokeFino;
        ctx.globalAlpha = (col.alphaTenue ?? 0.5);
        ctx.beginPath();
        ctx.arc(vp.X(Cc.x), vp.Y(Cc.y), worldToPx(k_world), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const trueAnomalyFromE = (E, e) => {
        const num = Math.sqrt(1 + e) * Math.sin(E / 2), den = Math.sqrt(1 - e) * Math.cos(E / 2);
        return 2 * Math.atan2(num, den);
      };
      const mapNu = (nu) => (attractorSide === 'right' ? nu : (Math.PI - nu));

      function drawArrowFrom(A, B, alpha, w, color) {
        drawSegment(ctx, A, B, color || col.ellipse, w, alpha, vp);
        const Lh = pxToWorld(state.arrowSizePx || 8);
        const dx = B.x - A.x, dy = B.y - A.y;
        const dn = Math.hypot(dx, dy) || 1, ux = dx / dn, uy = dy / dn;
        const wingDeg = 15;
        const ca = Math.cos(wingDeg * Math.PI / 180);
        const sa = Math.sin(wingDeg * Math.PI / 180);
        const ax1 = { x: B.x + Lh * (-ux * ca + uy * sa), y: B.y + Lh * (-uy * ca - ux * sa) };
        const ax2 = { x: B.x + Lh * (-ux * ca - uy * sa), y: B.y + Lh * (-uy * ca + ux * sa) };
        drawSegment(ctx, B, ax1, color || col.ellipse, w, alpha, vp);
        drawSegment(ctx, B, ax2, color || col.ellipse, w, alpha, vp);
      }

      if (showHodoFamily && fGiro > 0) {
        const step = (state.spacing || 0.8) * 12;
        for (let deg = 0; deg <= fGiro * 360; deg += step) {
          const E = +deg * Math.PI / 180;
          const nu = mapNu(trueAnomalyFromE(E, eabs));
          const vx_i = hodoSign * (-Math.sin(nu)), vy_i = hodoSign * (eabs + Math.cos(nu));
          drawArrowFrom(Hc, { x: Hc.x + k_world * vx_i, y: Hc.y + k_world * vy_i }, (col.traceAlpha ?? 0.15) * 1.3, col.traceWidth, col.faint);
        }
      }

      const nuAct = mapNu(trueAnomalyFromE(E0, eabs));
      const vTip = { x: Hc.x + k_world * hodoSign * (-Math.sin(nuAct)), y: Hc.y + k_world * hodoSign * (eabs + Math.cos(nuAct)) };
      drawArrowFrom(Hc, vTip, fTangentFade * (col.alphaFuerte ?? 1.0), col.strokeMedio, col.ellipse);

      if (hodoTrace && fGiro > 0) {
        state._hodoTrail = state._hodoTrail || [];
        state._hodoTrail.push({ x: vTip.x, y: vTip.y });
        if (state._hodoTrail.length > 2000) state._hodoTrail.shift();
        const alphaT = raiseTraceAlpha ? Math.min(0.25, (col.traceAlpha ?? 0.15) * 3) : (col.traceAlpha ?? 0.15);
        for (let i = 1; i < state._hodoTrail.length; i++) {
          drawSegment(ctx, state._hodoTrail[i - 1], state._hodoTrail[i], col.faint, col.traceWidth, alphaT, vp);
        }
      }
    })();

    // 12) Rastro de la punta de la flecha principal
    if (state.showTipTrail && Pend) {
      state._tipTrail = state._tipTrail || [];
      state._tipTrail.push({ x: Pend.x, y: Pend.y });
      const keep = Math.max(5, Math.floor(120 * trailKeep));
      const tr = state._tipTrail.slice(-keep);
      for (let i = 1; i < tr.length; i++) {
        drawSegment(ctx, tr[i - 1], tr[i], col.faint, col.traceWidth, (col.traceAlpha ?? 0.15), vp);
      }
    }

    // 13) Sectores de Kepler (áreas iguales en tiempos iguales)
    if (showAreaSector) {
      const getM = (E) => E - e * Math.sin(E);
      const solveEfromM = (M_t, E_i) => {
        let E = E_i;
        for (let i = 0; i < 14; i++) {
          const f = E - e * Math.sin(E) - M_t, fp = 1 - e * Math.cos(E);
          E -= f / (fp || 1e-12);
        }
        return E;
      };

      const drawSector = (E_a, E_b, fillColor) => {
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = fillColor;
        ctx.globalAlpha = 0.4 * fTangentFade; 
        ctx.moveTo(vp.X(focusX), vp.Y(0));
        let diff = E_b - E_a;
        if (diff > Math.PI)  diff -= 2 * Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;
        for (let i = 0; i <= areaArcSteps; i++) {
          const p = ellipsePoint(E_a + (diff * i) / areaArcSteps);
          ctx.lineTo(vp.X(p.x), vp.Y(p.y));
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      const currentM = getM(E0);
      if (areaSides === 'both' || areaSides === 'backward') {
        const Ea = solveEfromM(currentM - areaDeltaM, E0);
        drawSector(Ea, E0, areaMainColor);
      }
      if (areaSides === 'both' || areaSides === 'forward') {
        const Eb = solveEfromM(currentM + areaDeltaM, E0);
        drawSector(E0, Eb, areaMainColor);
      }

      if (areaOpposite) {
        const Epi = E0 + Math.PI, Mpi = getM(Epi);
        if (areaSides === 'both' || areaSides === 'backward') {
          const Ea2 = solveEfromM(Mpi - areaDeltaM, Epi);
          drawSector(Ea2, Epi, areaOppColor);
        }
        if (areaSides === 'both' || areaSides === 'forward') {
          const Eb2 = solveEfromM(Mpi + areaDeltaM, Epi);
          drawSector(Epi, Eb2, areaOppColor);
        }
      }
    }
  }

  // --- 2) Metadatos de UI: ocultar el botón "Rastros" en este modo ---
  // Varios alias para máxima compatibilidad con tu Core
  const uiHints = {
    showTrails: false,
    trails: false,
    showTrailsControl: false,
    trailsControl: false
  };
  drawOrbital.ui = Object.assign({}, drawOrbital.ui || {}, uiHints);

  // --- 3) Registro del modo con fallback de metadatos ---
  if (typeof ElipseLab.registerMode === 'function' && ElipseLab.registerMode.length >= 3) {
    // Cores que aceptan 3er argumento (meta)
    ElipseLab.registerMode('orbital', drawOrbital, { ui: uiHints });
  } else {
    // Cores que no usan meta: adjuntamos la pista en la función
    ElipseLab.registerMode('orbital', drawOrbital);
    // Si tu Core expone un setter opcional, lo invocamos sin romper nada
    if (typeof ElipseLab.setModeUi === 'function') {
      try { ElipseLab.setModeUi('orbital', uiHints); } catch {}
    }
  }
})();