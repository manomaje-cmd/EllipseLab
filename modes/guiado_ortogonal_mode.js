/**
 * Modo: guiado ortogonal
 * Versión: Con detección inteligente de mecanismos y Rótulos corregidos
 */
(function () {
  if (!window.ElipseLab) return;

  ElipseLab.registerMode('guiado_ortogonal', (ctx, state, H) => {
    const {
      viewport: vp, getColors, params,
      drawSegment, drawPoint, drawAxesExact,
      drawCircleWorld, drawLabel, drawHandle,
      clamp01
    } = H;

    // 1. Parámetros y Colores
    const col = getColors();
    const { a, b } = params();
    const t = state.t || 0;
    const dpr = vp.dpr || 1;
    
    const vCol = col.barColor || "#c2410c", vAlpha = col.barAlpha || 1, vWidth = col.barWidth || (2.5 * dpr);
    const jSize = col.jointSize || (3.5 * dpr), gris = col.faint || "#888", aAux = col.alphaTenue || 0.30;
    const R = (a + b) / 2, s = (a - b) / 2;

    const lerp = (x0, x1, u) => x0 + (x1 - x0) * u;
    const easeOutExpo = x => (x >= 1 ? 1 : (1 - Math.pow(2, -10 * Math.max(0, Math.min(1, x)))));
    const easeInCubic = x => Math.pow(Math.max(0, Math.min(1, x)), 3);
    const easeInOutCubic = x => (x < 0 ? 0 : x > 1 ? 1 : (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2));

    const getA = (id, baseA = vAlpha) => {
        const estaOculta = state[`_hide_${id}`];
        if (estaOculta) return state.showHidden ? 0.2 : 0;
        return baseA;
    };

    // 2. Función de etiquetas sin solape
    function placeAndDrawLabels(items) {
      if (!items || !items.length) return;
      const THR = 6 * dpr;
      const S = items.map(it => ({
        text: it.text, xs: vp.X(it.x), ys: vp.Y(it.y),
        size: it.size || 12, bold: it.bold || false, color: it.color || col.label || "#333"
      }));
      const used = new Array(S.length).fill(false);
      const clusters = [];
      for (let i = 0; i < S.length; i++) {
        if (used[i]) continue;
        const c = [i]; used[i] = true;
        let changed = true;
        while (changed) {
          changed = false;
          for (let j = 0; j < S.length; j++) {
            if (used[j]) continue;
            for (const k of c) {
              const dx = S[j].xs - S[k].xs, dy = S[j].ys - S[k].ys;
              if (dx * dx + dy * dy <= THR * THR) { c.push(j); used[j] = true; changed = true; break; }
            }
          }
        }
        clusters.push(c);
      }
      for (const c of clusters) {
        if (c.length === 1) {
          const it = S[c[0]];
          drawLabel(ctx, it.xs + 8, it.ys + 8, it.text, { align: "left", baseline: "middle", size: it.size, bold: it.bold, color: it.color }, vp);
        } else {
          const Rpx = 10 + 2 * c.length, a0 = -Math.PI / 2;
          for (let i = 0; i < c.length; i++) {
            const it = S[c[i]];
            const ang = a0 + i * (2 * Math.PI / c.length);
            drawLabel(ctx, it.xs + Rpx * Math.cos(ang), it.ys + Rpx * Math.sin(ang), it.text, { align: "center", baseline: "middle", size: it.size, bold: it.bold, color: it.color }, vp);
          }
        }
      }
    }

    

    const gW = 1 * dpr, gS = 2 * R;
    const aGFH = getA('gh_fix', aAux), aGFV = getA('gv_fix', aAux);
    if (aGFH > 0) drawSegment(ctx, { x: -gS, y: 0 }, { x: gS, y: 0 }, gris, gW, aGFH, vp);
    if (aGFV > 0) drawSegment(ctx, { x: 0, y: -gS }, { x: 0, y: gS }, gris, gW, aGFV, vp);

    // 4. Animaciones Iniciales
    const T1 = 0.04, T2 = 0.08, T3s = 0.15, T3e = 0.23;
    const fMove = easeOutExpo(clamp01(t / T1));
    const posX1 = a * fMove;
    const alphaC1 = aAux * (1 - clamp01((t - 0.12) / 0.03));
    if (alphaC1 > 0) drawCircleWorld(ctx, posX1, 0, b, gris, gW, alphaC1, vp);

    const O = { x: 0, y: 0 };
    const fSegAlpha = clamp01((t - T1) / (T2 - T1));
    const r0 = a + b; 
    let rAnim = (t < T3s) ? r0 : lerp(r0, 0, easeInCubic(clamp01((t - T3s) / (T3e - T3s))));
    if (fSegAlpha > 0 && rAnim > 1e-9 && aGFH > 0) {
        drawCircleWorld(ctx, O.x, O.y, rAnim, gris, gW, aAux * fSegAlpha, vp);
    }

    // 5. Rotación Principal
    const fGiro = clamp01((t - 0.25) / 0.75), theta = fGiro * 2 * Math.PI;
    const labels = [];

    if (fGiro > 0) {
      const M = { x: R * Math.cos(theta), y: R * Math.sin(theta) };
      const H_pt = { x: 2 * R * Math.cos(theta), y: 0 };
      const V_pt = { x: 2 * M.x - H_pt.x, y: 2 * M.y - H_pt.y };
      const E = { x: H_pt.x + (M.x - H_pt.x) * (b / R), y: H_pt.y + (M.y - H_pt.y) * (b / R) };

      // Elipse
      ctx.save(); ctx.strokeStyle = col.ellipse; ctx.lineWidth = col.strokeGrueso || (2.8 * dpr); 
      ctx.beginPath(); for (let u = 0; u <= theta + 0.02; u += 0.02) ctx.lineTo(vp.X(a * Math.cos(u)), vp.Y(b * Math.sin(u)));
      ctx.stroke(); ctx.restore();

      // Lógica de segmentos
      const th4 = -theta, ux4 = Math.cos(th4), uy4 = -Math.sin(th4);
      const Rpt = { x: s * Math.cos(th4), y: s * Math.sin(th4) };
      const Hpr = { x: Rpt.x + s * ux4, y: Rpt.y + s * uy4 };
      const endVS4 = { x: Rpt.x + R * ux4, y: Rpt.y + R * uy4 };

      const fMec = easeInOutCubic(clamp01((t - 0.15) / 0.05));
      const CT = Math.cos(theta), ST = Math.sin(theta);
      const P = { x: b * CT, y: b * ST };
      const xG = a * CT, I = { x: xG, y: 0 }, Vp = { x: 0, y: -(a - b) * ST };
      const N = (Math.abs(CT) > 1e-9) ? { x: xG, y: (xG / CT) * ST } : null;

      const aHE = getA('HE'), aEM = getA('EM'), aMV = getA('MV');
      const aOR = getA('OR', 1), aRHpr = getA('RHpr', vAlpha), aHprE = getA('HprE', vAlpha);
      const aOP = getA('OP', fMec), aPM = getA('PM', fMec), aMN = getA('MN', fMec), aRVp = getA('RVp');
      const aRueda = getA('rueda_OR', aAux);

      // Dibujo Barras
      if (aRueda > 0 && Math.abs(s) > 1e-9) drawCircleWorld(ctx, 0, 0, Math.abs(s), gris, gW, aRueda, vp);
      if (aHE > 0) drawSegment(ctx, H_pt, E, vCol, vWidth, aHE, vp);
      if (aEM > 0) drawSegment(ctx, E, M, vCol, vWidth, aEM, vp);
      if (aMV > 0) drawSegment(ctx, M, V_pt, vCol, vWidth, aMV, vp);
      if (aRHpr > 0) drawSegment(ctx, Rpt, Hpr, vCol, vWidth, aRHpr, vp);
      if (aHprE > 0) drawSegment(ctx, Hpr, endVS4, vCol, vWidth, aHprE, vp);
      if (aOR > 0) drawSegment(ctx, O, Rpt, "#000", 2 * dpr, aOR, vp);

      if (fMec > 0) {
        if (getA('gv_mob', aAux) > 0) drawSegment(ctx, { x: xG, y: -a }, { x: xG, y: a }, gris, gW, getA('gv_mob', aAux) * fMec, vp);
        if (getA('gh_mob', aAux) > 0) {
          const sLF = (a - b);
          drawSegment(ctx, { x: xG - sLF, y: E.y }, { x: xG + sLF, y: E.y }, gris, gW, getA('gh_mob', aAux) * fMec, vp);
        }
        if (aOP > 0) drawSegment(ctx, O, P, vCol, vWidth, aOP, vp);
        if (aPM > 0) drawSegment(ctx, P, M, vCol, vWidth, aPM, vp);
        if (aMN && N && aMN > 0) drawSegment(ctx, M, N, vCol, vWidth, aMN, vp);
        if (aRVp > 0) drawSegment(ctx, Rpt, Vp, vCol, vWidth, aRVp, vp);
      }

      // --- SECCIÓN DE PUNTOS CORREGIDA ---
      const drawJ = (p, aVal) => { if (aVal > 0.05) drawPoint(ctx, p.x, p.y, col.ellipse, jSize, true, aVal, vp); };
      
      const visM = Math.max(aEM, aMV, aPM, aMN);
      // P solo se muestra si la guía móvil (gh_mob) es visible; si no, se oculta para que parezca una barra rígida
      const guiaGrisActiva = !state._hide_gh_mob;
      const visP = (fMec > 0.1 && guiaGrisActiva) ? Math.max(aOP, aPM) : 0;
      const visR = (aOR > 0.1) ? Math.max(aOR, aRHpr, aRVp) : 0;

      // DETECCIÓN ULTRA-SEGURA DE PROCLO (usando el estado directamente)
      const esProclo = (!state._hide_gh_fix && !state._hide_gv_fix && !state._hide_HE && !state._hide_EM && !state._hide_MV && 
                        state._hide_OR && state._hide_OP && state._hide_RHpr);

      drawJ(O, Math.max(aOR, aHE, aOP, 0.5));
      
      // AQUÍ LA MAGIA: Si es Proclo, le mandamos un 0 de visibilidad a M
      drawJ(M, esProclo ? 0 : visM);

      drawJ(H_pt, aHE);
      drawJ(V_pt, aMV);
      drawJ(Rpt, visR);
      drawJ(Hpr, Math.max(aRHpr, aHprE));
      drawJ(P, visP);
      if (fMec > 0) {
        drawJ(Vp, aRVp);
        if (N) drawJ(N, aMN);
        drawJ(I, getA('gv_mob', aAux) * fMec);
      }

      // Trazador E
      const dragging = state && (state._dragTarget === "vs0_tracer");
      ctx.save(); ctx.globalAlpha = 0.9; ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.beginPath(); ctx.arc(vp.X(E.x), vp.Y(E.y), dragging ? 12.5 * dpr : 10 * dpr, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      drawPoint(ctx, E.x, E.y, "#ef4444", jSize * 1.4, false, 1, vp);

      // 3. Ejes y Guías
      if (state.showAxes) drawAxesExact(ctx, a, b, vp);
      drawHandle(ctx, a, 0, "#ff0000", "h", 1, vp);

      // --- 6. LÓGICA DE RÓTULOS (RESTAURADA) ---
      function dibujarRotulo(texto) {
          ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr);
          const xCentro = (ctx.canvas.width / dpr) / 2;
          ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = col.barColor || "#333"; ctx.font = "bold 24px serif";
          ctx.fillText(texto, xCentro, 45); 
          ctx.beginPath(); ctx.moveTo(xCentro - 90, 77); ctx.lineTo(xCentro + 90, 77);
          ctx.strokeStyle = col.barColor || "#333"; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.3; ctx.stroke();
          ctx.restore();
      }

      const h_ = (id) => !!state[`_hide_${id}`];
      const v_ = (id) => !state[`_hide_${id}`];

      // Kleiber: ocultos rueda_OR + MV + HE, visible el resto Y las guías móviles (cruz en E)
      if (h_('rueda_OR') && h_('MV') && h_('HE') &&
          v_('EM') && v_('OR') && v_('OP') && v_('PM') && v_('MN') && v_('RVp') &&
          v_('RHpr') && v_('HprE') && v_('gh_fix') && v_('gv_fix') &&
          v_('gh_mob') && v_('gv_mob')) { // <--- Estas dos son la cruz que pasa por E
          dibujarRotulo("Kleiber");
      }
      // Proclo / Arquímedes (Versión Estricta)
      else if (
          v_('gh_fix') && v_('gv_fix') && v_('HE') && v_('EM') && v_('MV') && // Lo que se DEBE ver
          h_('OR') && h_('OP') && h_('PM') && h_('MN') && h_('RVp') &&      // Lo que DEBE estar oculto
          h_('rueda_OR') && h_('gv_mob') && h_('gh_mob') && h_('RHpr')      // Más limpieza
      ) {
          dibujarRotulo("Proclo / Arquímedes");
      }
      // Proclo / Leonardo: Guías fijas + línea colineal V'-E. El resto (incluida la rueda) oculto.
      else if (v_('gh_fix') && v_('gv_fix') && v_('RVp') && v_('RHpr') && v_('HprE') &&
               h_('HE') && h_('EM') && h_('MV') && h_('OR') && h_('OP') && h_('PM') && 
               h_('rueda_OR')) {
          dibujarRotulo("Proclo / Leonardo");
      }
      // Van Schooten: Ejes fijos + Rombo (OP, PM, HE, EM). Todo lo demás oculto.
      else if (v_('gh_fix') && v_('gv_fix') && v_('OP') && v_('PM') && v_('HE') && v_('EM') && 
               h_('MN') && h_('gh_mob') && h_('gv_mob') &&
               h_('MV') && h_('OR') && h_('RVp') && h_('RHpr') && h_('HprE') && h_('rueda_OR')) {
          dibujarRotulo("van Schooten");
      }
      // Etiquetas finales
      const pushL = (txt, p, aVal, estilo = {}) => { if (aVal > 0.1) labels.push({ text: txt, x: p.x, y: p.y, ...estilo }); };
      if (!(h_('rueda_OR') && h_('MV'))) pushL("R", Rpt, visR, { size: 12 });
      pushL("O", O, 1, { size: 12 });
      pushL("M", M, visM, { size: 12 });
      pushL("H", H_pt, aHE, { size: 12 });
      pushL("E", E, 1, { size: 14, bold: true }); 
      pushL("V", V_pt, aMV, { size: 12 });
      pushL("P", P, visP, { size: 12 });
      if (fMec > 0) {
          pushL("V'", Vp, aRVp, { size: 12 });
          pushL("I", I, (state._hide_gv_mob ? 0 : 1) * fMec, { size: 12 });
          if (N) pushL("N", N, aMN, { size: 12 });
      }
      placeAndDrawLabels(labels);
    }
  });
})();