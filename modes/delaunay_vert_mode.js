(function () {
  if (!window.ElipseLab) return;

  ElipseLab.registerMode('delaunay_vert', (ctx, state, H) => {
    const { 
      viewport: vp, getColors, params, clamp01,
      drawSegment, drawPoint, drawHandle, drawFoci,
      drawAxesExact
    } = H;

    const col = getColors();
    const { a, b } = params();
    const t = Number(state.t || 0);

    const G = window.ElipseLab.state;
    if (typeof G._delaunay_vert_init      === 'undefined') G._delaunay_vert_init = false;
    if (typeof G._delaunay_vert_userMoved === 'undefined') G._delaunay_vert_userMoved = false;
    if (typeof G._delaunay_vert_dragging  === 'undefined') G._delaunay_vert_dragging = false;
    if (typeof G._delaunay_vert_anchorDx  === 'undefined') G._delaunay_vert_anchorDx = 0;
    if (typeof G.delaunay_vert_arr_ox     !== 'number')    G.delaunay_vert_arr_ox = 0;

    if (typeof G._dva_spanY_min !== 'number') G._dva_spanY_min = -3 * Math.max(a,b);
    if (typeof G._dva_spanY_max !== 'number') G._dva_spanY_max =  3 * Math.max(a,b);

    const r = (a ? b / a : 0);
    const r_inv = (b ? a / b : 0);
    const c = Math.sqrt(Math.max(0, a*a - b*b));
    const L0 = c + 2 * b;

    const fFadeRueda = clamp01(t * 20);
    const fDesplazar = clamp01((t - 0.02) / 0.1);
    const fFadeGuia  = clamp01((t - 0.15) / 0.05);
    const fFadeMec   = clamp01((t - 0.20) / 0.05);
    const fGiro      = clamp01((t - 0.25) / 0.75);

    const gap = b * 0.5;
    const xTeoricoM       = (gap + b);
    const xTeoricoEje     = gap;
    const f_lat           = (1 - (b ? a/b : 0)) / 2;
    const xTeoricoC       = xTeoricoEje + (xTeoricoM - xTeoricoEje) * f_lat;
    const traslacionFinal = -(2 * xTeoricoC - xTeoricoM);

    const xRuedaFinalIntro  = xTeoricoM + traslacionFinal;
    const centroGuiaX_intro = 0 + (xRuedaFinalIntro - 0) * fDesplazar;
    const ejeX_intro        = xTeoricoEje + (traslacionFinal * fDesplazar);

    const userMoved = !!G._delaunay_vert_userMoved;
    const ox = userMoved ? G.delaunay_vert_arr_ox : centroGuiaX_intro;
    if (!userMoved) G.delaunay_vert_arr_ox = centroGuiaX_intro;

    const ejeX_user = (1 / (1 + (r || 1))) * ox;
    const ejeX = userMoved ? ejeX_user : ejeX_intro;
    
    const Lmin = b + Math.abs(ox) / (1 + (r_inv || 1));
    const L    = Math.max(L0, Lmin + 0.02 * b);

    const ang = -(fGiro * Math.PI * 2) + Math.PI;
    const M = { x: ox + b * Math.cos(ang), y: b * Math.sin(ang) };
    const dxM = Math.abs(M.x - ejeX);
    const dy  = Math.sqrt(Math.max(0, L * L - dxM * dxM));

    const A = { x: ejeX, y: M.y - dy };
    const B = { x: ejeX, y: M.y + dy };
    const C = { x: A.x + (M.x - A.x) * f_lat, y: A.y + (M.y - A.y) * f_lat };
    const D = { x: B.x + (M.x - B.x) * f_lat, y: B.y + (M.y - B.y) * f_lat };
    const M_prime = { x: C.x + D.x - M.x, y: C.y + D.y - M.y };

    if (state.showAxes && typeof drawAxesExact === 'function') {
      drawAxesExact(ctx, a, b, vp);
    } else {
      drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp);
    }
    
    if (state.showFoci) {
      drawFoci(ctx, a, b, vp);
    }


    if (fFadeRueda > 0) {
  ctx.save();
  ctx.globalAlpha = fFadeRueda;

  // Circunferencia de la rueda
  ctx.beginPath();
  ctx.arc(vp.X(ox), vp.Y(0), b * vp.scale * vp.userZoom, 0, Math.PI * 2);
  ctx.strokeStyle = col.faint;
  ctx.lineWidth   = col.strokeFino;
  ctx.stroke();

  // Manivela/handle del centro
  drawHandle(ctx, ox, 0, "#ff0000", 'h', 1, vp);

  // ===== RADIO DE LA RUEDA (de centro a M) =====
  // Mismo estilo que en 'delaunay_horiz'
  drawSegment(
    ctx,
    { x: ox, y: 0 },   // centro de la rueda
    M,                 // punto que gira
    col.axis,          // color
    col.strokeGrueso * 0.8, // grosor
    1,                 // opacidad
    vp
  );

  // Punto del centro con el mismo tamaño relativo que en horizontal
  drawPoint(ctx, ox, 0, col.axis, Math.max(2, col.jointSize * 0.9), true, 1, vp);

  ctx.restore();
}

    if (fFadeGuia > 0) {
      ctx.save();
      ctx.globalAlpha = fFadeGuia;
      drawSegment(ctx, { x: ejeX, y: G._dva_spanY_min }, { x: ejeX, y: G._dva_spanY_max }, col.faint, col.strokeFino, 0.9, vp);
      ctx.restore();
    }

    if (fFadeMec > 0) {
      ctx.save();
      ctx.globalAlpha = fFadeMec;
      const barraCol = col.barColor || "#c2410c";
      [ [M,C], [C,M_prime], [M,D], [D,M_prime] ].forEach(seg =>
        drawSegment(ctx, seg[0], seg[1], barraCol, col.barWidth, 0.9, vp)
      );
      [A, B].forEach(p => drawPoint(ctx, p.x, p.y, col.axis, col.jointSize, true, 1, vp));
      [M, C, D, M_prime].forEach(p => drawPoint(ctx, p.x, p.y, col.barColor, col.jointSize * 0.9, true, 1, vp));
      ctx.restore();
    }

    if (fGiro > 0) {
      ctx.save();
      ctx.strokeStyle = col.ellipse;
      ctx.lineWidth   = col.strokeGrueso;
      ctx.beginPath();
      for (let u = 0; u <= fGiro + 0.005; u += 0.01) {
        ctx.lineTo(vp.X(a * Math.cos(u * Math.PI * 2)), vp.Y(b * Math.sin(u * Math.PI * 2)));
      }
      ctx.stroke();
      ctx.restore();
      drawPoint(ctx, M_prime.x, M_prime.y, col.ellipse, col.jointSize * 1.5, true, 1, vp);
    }

    // ===== INTERACCIÓN =====
    if (!G._delaunay_vert_arr_init) {
      G._delaunay_vert_arr_init = true;
      const canvas = ctx.canvas;

      // FIX: usa vp.toWorldX (correcto con Y-flip)
      const toWorld = (ev) => {
        const rect = canvas.getBoundingClientRect();
        return { gx: vp.toWorldX(ev.clientX - rect.left) };
      };

      const onDown = (ev) => {
        if (!G.activeLayers?.includes('delaunay_vert')) return;
        const rect = canvas.getBoundingClientRect();
        const mx = ev.clientX - rect.left;
        const my = ev.clientY - rect.top;

        // FIX: comparar en espacio CSS usando toCSSX/toCSSY
        const cx = vp.toCSSX(G.delaunay_vert_arr_ox);
        const cy = vp.toCSSY(0);
        const rPx = Math.abs(b) * vp.scale * vp.userZoom;
        const d = Math.hypot(mx - cx, my - cy);

        if (d > Math.max(40, 15 * (vp.dpr || 1)) && Math.abs(d - rPx) > 10) return;

        ev.preventDefault();
        ev.stopImmediatePropagation();

        const { gx } = toWorld(ev);
        G._delaunay_vert_anchorDx = G.delaunay_vert_arr_ox - gx;
        G._delaunay_vert_dragging = true;
        G._delaunay_vert_userMoved = true;
        canvas.setPointerCapture(ev.pointerId);

        const onMove = (e) => {
          if (!G._delaunay_vert_dragging) return;
          const { gx } = toWorld(e);
          G.delaunay_vert_arr_ox = gx + G._delaunay_vert_anchorDx;
          window.ElipseLab.syncPanel();
        };

        const onUp = () => {
          G._delaunay_vert_dragging = false;
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