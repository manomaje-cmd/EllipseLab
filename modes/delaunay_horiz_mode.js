(function () {
  if (!window.ElipseLab) return;

  ElipseLab.registerMode('delaunay_horiz', (ctx, state, H) => {
    const { 
      viewport: vp, getColors, params, clamp01,
      drawSegment, drawPoint, drawHandle, drawFoci,
      drawAxesExact
    } = H;

    const col = getColors();
    const { a, b } = params();
    const t = Number(state.t || 0);

    const G = window.ElipseLab.state;
    if (typeof G._delaunay_arr_init         === 'undefined') G._delaunay_arr_init = false;
    if (typeof G._delaunay_arr_userMoved    === 'undefined') G._delaunay_arr_userMoved = false;
    if (typeof G._delaunay_arr_dragging     === 'undefined') G._delaunay_arr_dragging = false;
    if (typeof G._delaunay_arr_anchorDy     === 'undefined') G._delaunay_arr_anchorDy = 0;
    if (typeof G.delaunay_arr_oy            !== 'number')    G.delaunay_arr_oy = 0;

    const ratio = (a ? b / a : 0);
    const f = (1 - ratio) / 2;
    const c = Math.sqrt(Math.max(0, a * a - b * b));
    const L0 = c + 2 * a;

    const fFadeBase = clamp01(t / 0.05);
    const fFadeMec  = clamp01((t - 0.10) / 0.10);
    const fGiro     = clamp01((t - 0.25) / 0.75);

    const gap           = a * 0.5;
    const yTeoricaM     = (gap + a);
    const yTeoricaEje   = gap;
    const yTeoricaC     = yTeoricaEje + (yTeoricaM - yTeoricaEje) * f;
    const yRuedaFinal   = yTeoricaM - (2 * yTeoricaC - yTeoricaM);

    const userMoved = !!G._delaunay_arr_userMoved;
    const oy = userMoved ? G.delaunay_arr_oy : yRuedaFinal;
    if (!userMoved) G.delaunay_arr_oy = yRuedaFinal;

    const ejeY = (1 + ratio ? (ratio / (1 + ratio)) * oy : 0);
    const L = Math.max(L0, (a + Math.abs(oy) / (1 + (ratio || 1))) + 0.02 * a);

    const ang = -(fGiro * Math.PI * 2);
    const M = { x: a * Math.cos(ang), y: oy + a * Math.sin(ang) };
    const inside = Math.max(0, L * L - Math.pow(M.y - ejeY, 2));
    const dx = Math.sqrt(inside);

    const A = { x: M.x - dx, y: ejeY };
    const B = { x: M.x + dx, y: ejeY };
    const C = { x: A.x + (M.x - A.x) * f, y: A.y + (M.y - A.y) * f };
    const D = { x: B.x + (M.x - B.x) * f, y: B.y + (M.y - B.y) * f };
    const M_prime = { x: C.x + D.x - M.x, y: C.y + D.y - M.y };

    if (state.showAxes && typeof drawAxesExact === 'function') {
      drawAxesExact(ctx, a, b, vp);
    } else {
      drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp);
    }
 
    if (state.showFoci) {
      drawFoci(ctx, a, b, vp);
    }


    const s = vp.scale * vp.userZoom;

    if (fFadeBase > 0) {
      ctx.save();
      ctx.globalAlpha = fFadeBase;
      drawSegment(ctx, { x: -L * 1.5, y: ejeY }, { x: L * 1.5, y: ejeY }, col.axis, col.strokeFino, 1, vp);
      ctx.save();
      ctx.strokeStyle = col.faint;
      ctx.lineWidth = col.strokeFino;
      ctx.beginPath();
      ctx.arc(vp.X(0), vp.Y(oy), a * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // ===== RADIO DE LA RUEDA (de centro a M) =====
      drawSegment(
        ctx,
        { x: 0, y: oy },   // centro de la rueda
        M,                 // punto que gira
        col.axis,          // color (puedes cambiarlo)
        col.strokeGrueso * 0.8,
        1,
        vp
      );
      drawPoint(ctx, 0, oy, col.axis, Math.max(2, col.jointSize * 0.9), true, 1, vp);
      drawHandle(ctx, 0, oy, "#ff0000", 'v', 1, vp);
      ctx.restore();
    }

    if (fFadeMec > 0) {
      ctx.save();
      ctx.globalAlpha = fFadeMec;
      const barraCol = col.barColor || "#c2410c";
      [ [A,M], [B,M], [C,M_prime], [D,M_prime] ].forEach(seg =>
        drawSegment(ctx, seg[0], seg[1], barraCol, col.barWidth, 0.9, vp)
      );
      [A, B, C, D, M].forEach(p => drawPoint(ctx, p.x, p.y, col.axis, col.jointSize * 0.9, true, 1, vp));
      ctx.restore();
    }

    if (fGiro > 0) {
      ctx.save();
      ctx.strokeStyle = col.ellipse;
      ctx.lineWidth   = col.strokeGrueso;
      ctx.beginPath();
      for (let i = 0; i <= fGiro + 0.005; i += 0.01) {
        ctx.lineTo(vp.X(a * Math.cos(i * Math.PI * 2)), vp.Y(b * Math.sin(i * Math.PI * 2)));
      }
      ctx.stroke();
      ctx.restore();
      drawPoint(ctx, M_prime.x, M_prime.y, col.ellipse, col.jointSize * 1.5, true, 1, vp);
    }

    // ===== INTERACCIÓN =====
    if (!G._delaunay_arr_init) {
      G._delaunay_arr_init = true;
      const canvas = ctx.canvas;

      // FIX: usa vp.toWorldY (correcto con Y-flip)
      const toWorld = (ev) => {
        const rect = canvas.getBoundingClientRect();
        return { gy: vp.toWorldY(ev.clientY - rect.top) };
      };

      const onDown = (ev) => {
        if (!G.activeLayers?.includes('delaunay_horiz')) return;
        const rect = canvas.getBoundingClientRect();
        const mx = ev.clientX - rect.left;
        const my = ev.clientY - rect.top;

        // FIX: comparar en espacio CSS usando toCSSX/toCSSY
        const px = vp.toCSSX(0);
        const py = vp.toCSSY(G.delaunay_arr_oy);
        const dist = Math.hypot(mx - px, my - py);

        if (dist > 40 * (vp.dpr || 1)) return;

        ev.preventDefault();
        ev.stopImmediatePropagation();

        const { gy } = toWorld(ev);
        G._delaunay_arr_anchorDy = G.delaunay_arr_oy - gy;
        G._delaunay_arr_dragging = true;
        G._delaunay_arr_userMoved = true;
        canvas.setPointerCapture(ev.pointerId);

        const onMove = (e) => {
          if (!G._delaunay_arr_dragging) return;
          const { gy } = toWorld(e);
          G.delaunay_arr_oy = gy + G._delaunay_arr_anchorDy;
          window.ElipseLab.syncPanel();
        };

        const onUp = () => {
          G._delaunay_arr_dragging = false;
          canvas.releasePointerCapture(ev.pointerId);
          canvas.removeEventListener('pointermove', onMove, true);
          canvas.removeEventListener('pointerup', onUp, true);
        };

        canvas.addEventListener('pointermove', onMove, true);
        canvas.addEventListener('pointerup', onUp, true);
        window.ElipseLab.syncPanel();
      };
      canvas.addEventListener('pointerdown', onDown, { capture: true });
    }
  });
})();