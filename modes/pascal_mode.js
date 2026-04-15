/**
 * Modo: pascal
 * * 6 puntos arrastrables sobre la elipse → hexágono inscrito → recta de Pascal.
 */
(function () {
  if (!window.ElipseLab) return;

  const Lab = window.ElipseLab;
  const TAU = Math.PI * 2;

  const COL_PASCAL = '#2563eb';
  const COL_OPP    = ['#f59e0b', '#10b981', '#8b5cf6'];
  const PT_COLORS = ['#dc2626','#dc2626','#dc2626','#dc2626','#dc2626','#dc2626'];

  function defaultAngles() {
    return [0,1,2,3,4,5].map(i => (i / 6) * TAU + 0.3);
  }

  function projectToEllipse(wx, wy, a, b) {
    let theta = Math.atan2(wy / b, wx / a);
    for (let i = 0; i < 8; i++) {
      const ex = a * Math.cos(theta), ey = b * Math.sin(theta);
      const dx = ex - wx, dy = ey - wy;
      const dex = -a * Math.sin(theta), dey = b * Math.cos(theta);
      const d2ex = -a * Math.cos(theta), d2ey = -b * Math.sin(theta);
      const f  = dx * dex + dy * dey;
      const fp = dex*dex + dey*dey + dx*d2ex + dy*d2ey;
      if (Math.abs(fp) < 1e-12) break;
      theta -= f / fp;
    }
    return theta;
  }

  function segIntersect(A, B, C, D) {
    const dx1 = B.x-A.x, dy1 = B.y-A.y;
    const dx2 = D.x-C.x, dy2 = D.y-C.y;
    const denom = dx1*dy2 - dy1*dx2;
    if (Math.abs(denom) < 1e-10) return null;
    const t = ((C.x-A.x)*dy2 - (C.y-A.y)*dx2) / denom;
    return { x: A.x + t*dx1, y: A.y + t*dy1 };
  }

  function ensureListeners(canvas, modeId) {
    const key = `_pbBound_${modeId}`;
    if (Lab.state[key]) return;
    Lab.state[key] = true;

    const onDown = (ev) => {
      const isActive = (Lab.state.activeLayers || []).includes(modeId);
      if (!isActive) return;
      const vp = Lab.viewport;
      const rect = canvas.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const my = (ev.clientY - rect.top)  * (canvas.height / rect.height);
      const a = Lab.state.a, b = Lab.state.b;
      const angles = Lab.state._pbAngles || defaultAngles();
      const tol = 18 * (vp.dpr || 1);
      let hit = -1;
      for (let i = 0; i < 6; i++) {
        const px = vp.toCSSX(a * Math.cos(angles[i])) * (vp.dpr || 1);
        const py = vp.toCSSY(b * Math.sin(angles[i])) * (vp.dpr || 1);
        if (Math.hypot(mx - px, my - py) < tol) { hit = i; break; }
      }
      if (hit < 0) return;
      ev.preventDefault(); ev.stopPropagation();
      Lab.state._pbDrag = hit;
      canvas.setPointerCapture?.(ev.pointerId);
      Lab._redraw?.();
    };

    const onMove = (ev) => {
      if (Lab.state._pbDrag == null || Lab.state._pbDrag < 0) return;
      ev.preventDefault(); ev.stopPropagation();
      const vp = Lab.viewport;
      const rect = canvas.getBoundingClientRect();
      const wx = vp.toWorldX(ev.clientX - rect.left);
      const wy = vp.toWorldY(ev.clientY - rect.top);
      const angles = Lab.state._pbAngles || defaultAngles();
      angles[Lab.state._pbDrag] = projectToEllipse(wx, wy, Lab.state.a, Lab.state.b);
      Lab.state._pbAngles = angles;
      Lab._redraw?.();
    };

    const onUp = (ev) => {
      if (Lab.state._pbDrag == null || Lab.state._pbDrag < 0) return;
      Lab.state._pbDrag = -1;
      canvas.releasePointerCapture?.(ev.pointerId);
      Lab._redraw?.();
    };

    canvas.addEventListener('pointerdown', onDown, { capture: true });
    canvas.addEventListener('pointermove', onMove, { capture: true });
    canvas.addEventListener('pointerup',   onUp,   { capture: true });
    canvas.addEventListener('pointercancel', onUp, { capture: true });
  }

  function drawDraggable(ctx, x, y, color, vp, active) {
    const dpr = vp.dpr || 1;
    const r = active ? 7*dpr : 5*dpr;
    ctx.save();
    ctx.globalAlpha = 0.95; ctx.fillStyle = color; 
    ctx.beginPath(); ctx.arc(vp.X(x), vp.Y(y), r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5*dpr; ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 1.2*dpr; ctx.globalAlpha = 1;
    ctx.setLineDash([3*dpr, 3*dpr]);
    ctx.beginPath(); ctx.arc(vp.X(x), vp.Y(y), r + 5*dpr, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  function drawExtendedLine(ctx, A, B, color, width, alpha, vp, ext) {
    const dx = B.x-A.x, dy = B.y-A.y, len = Math.sqrt(dx*dx+dy*dy)||1;
    const ux = dx/len, uy = dy/len;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(vp.X(A.x - ux*ext), vp.Y(A.y - uy*ext));
    ctx.lineTo(vp.X(A.x + ux*ext), vp.Y(A.y + uy*ext));
    ctx.stroke();
    ctx.restore();
  }

  Lab.registerMode('pascal', (ctx, state, H) => {
    const { viewport: vp, getColors, params,
            drawSegment, drawPoint, drawEllipse,
            drawAxesExact, drawHandle, drawLabel, drawFoci } = H;

    const col = getColors();
    const { a, b } = params();
    const dpr = vp.dpr || 1;

    if (!state._pbAngles || state._pbAngles.length !== 6)
      state._pbAngles = defaultAngles();
    if (state._pbDrag == null) state._pbDrag = -1;

    ensureListeners(ctx.canvas, 'pascal');

    if (state.showAxes) drawAxesExact(ctx, a, b, vp);
    drawHandle(ctx, a, 0, '#ff0000', 'h', 1, vp);
    drawEllipse(ctx, a, b, col.ellipse, col.strokeGrueso, vp);

    const angles = state._pbAngles;
    const pts = angles.map(th => ({ x: a * Math.cos(th), y: b * Math.sin(th) }));
    const ext = Math.max(a, b) * 5;

    // 1. Cálculo de intersecciones
    const X1 = segIntersect(pts[0], pts[1], pts[3], pts[4]);
    const X2 = segIntersect(pts[1], pts[2], pts[4], pts[5]);
    const X3 = segIntersect(pts[2], pts[3], pts[5], pts[0]);

    // 2. Lados y Extensiones
    const sideCI = [0, 1, 2, 0, 1, 2];
    const intersections = [X1, X2, X3, X1, X2, X3]; 

    for (let i = 0; i < 6; i++) {
      const pA = pts[i];
      const pB = pts[(i + 1) % 6];
      const targetX = intersections[i];

      if (targetX) {
        ctx.save();
        ctx.strokeStyle = COL_OPP[sideCI[i]];
        ctx.lineWidth = 1 * dpr;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(vp.X(pA.x), vp.Y(pA.y));
        ctx.lineTo(vp.X(targetX.x), vp.Y(targetX.y));
        ctx.stroke();
        ctx.restore();
      }
      drawSegment(ctx, pA, pB, COL_OPP[sideCI[i]], 2 * dpr, 0.8, vp);
    }

    // 3. Puntos de intersección
    if (X1) drawPoint(ctx, X1.x, X1.y, COL_OPP[0], 4 * dpr, false, 1, vp);
    if (X2) drawPoint(ctx, X2.x, X2.y, COL_OPP[1], 4 * dpr, false, 1, vp);
    if (X3) drawPoint(ctx, X3.x, X3.y, COL_OPP[2], 4 * dpr, false, 1, vp);

    // 4. Recta de Pascal
    if (X1 && X2) {
      drawExtendedLine(ctx, X1, X2, COL_PASCAL, 2 * dpr, 0.9, vp, ext * 10);
    }

    // 5. Draggables y etiquetas
    for (let i = 0; i < 6; i++) {
      drawDraggable(ctx, pts[i].x, pts[i].y, PT_COLORS[0], vp, state._pbDrag === i);
      const off = 15 / (vp.scale * vp.userZoom);
      const nx = Math.cos(angles[i]), ny = Math.sin(angles[i]);
      drawLabel(ctx,
        vp.X(pts[i].x + nx * off), vp.Y(pts[i].y + ny * off),
        String(i + 1),
        { size: 10, bold: true, color: PT_COLORS[0], align: 'center' }, vp);
    }
    // --- BLOQUE DE FOCOS ---
    if (state.showFoci) {
      drawFoci(ctx, a, b, vp);
    }
    // -----------------------
  });
})();