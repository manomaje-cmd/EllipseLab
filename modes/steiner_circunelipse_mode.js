/**
 * Modo: steiner_circunelipse
 * Triángulos de Steiner INSCRITOS en la elipse + inscritos afines en la circunferencia.
 */
(function () {
  if (!window.ElipseLab) return;

  const Lab = window.ElipseLab;
  const TAU = Math.PI * 2;
  const PT_COLORS = ['#e11d48','#d97706','#16a34a','#2563eb','#7c3aed','#0891b2'];

  function defaultAngles() {
    return [0,1,2,3,4,5].map(i => (i / 6) * TAU + 0.3);
  }

  function projectToEllipse(wx, wy, a, b) {
    let theta = Math.atan2(wy / b, wx / a);
    for (let i = 0; i < 8; i++) {
      const ex = a*Math.cos(theta), ey = b*Math.sin(theta);
      const dx = ex-wx, dy = ey-wy;
      const dex = -a*Math.sin(theta), dey = b*Math.cos(theta);
      const d2ex = -a*Math.cos(theta), d2ey = -b*Math.sin(theta);
      const f  = dx*dx + dy*dy; // Corregido: dx*dex + dy*dey en versiones previas
      const fp = dex*dex + dey*dey + dx*d2ex + dy*d2ey;
      if (Math.abs(fp) < 1e-12) break;
      theta -= f / fp;
    }
    return theta;
  }

  function tangentAt(theta, a, b) {
    const px = a*Math.cos(theta), py = b*Math.sin(theta);
    const dx = -a*Math.sin(theta), dy = b*Math.cos(theta);
    const len = Math.sqrt(dx*dx+dy*dy)||1;
    return { pt: {x:px, y:py}, dx: dx/len, dy: dy/len };
  }

  function ensureListeners(canvas) {
    if (Lab.state._pbBound_steiner_circ) return;
    Lab.state._pbBound_steiner_circ = true;

    function isActive() {
      return (Lab.state.activeLayers || []).includes('steiner_circunelipse');
    }

    const onDown = (ev) => {
      if (!isActive()) return;
      const vp = Lab.viewport;
      const rect = canvas.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const my = (ev.clientY - rect.top)  * (canvas.height / rect.height);
      const { a, b } = Lab.state;
      const angles = Lab.state._pbAngles || defaultAngles();
      const tol = 22 * (vp.dpr || 1);
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
      if (!isActive()) return;
      ev.preventDefault(); ev.stopPropagation();
      const vp = Lab.viewport;
      const rect = canvas.getBoundingClientRect();
      const wx = vp.toWorldX(ev.clientX - rect.left);
      const wy = vp.toWorldY(ev.clientY - rect.top);
      const angles = Lab.state._pbAngles || defaultAngles();
      angles[Lab.state._pbDrag] = projectToEllipse(wx, wy, Lab.state.a, Lab.state.b);
      Lab.state._pbAngles = [...angles];
      Lab._redraw?.();
    };

    const onUp = (ev) => {
      if (Lab.state._pbDrag == null || Lab.state._pbDrag < 0) return;
      Lab.state._pbDrag = -1;
      canvas.releasePointerCapture?.(ev.pointerId);
      Lab._redraw?.();
    };

    canvas.addEventListener('pointerdown',   onDown, { capture: true });
    canvas.addEventListener('pointermove',   onMove, { capture: true });
    canvas.addEventListener('pointerup',     onUp,   { capture: true });
    canvas.addEventListener('pointercancel', onUp,   { capture: true });
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

  Lab.registerMode('steiner_circunelipse', (ctx, state, H) => {
    const { viewport: vp, getColors, params,
            drawPoint, drawEllipse, drawCircleWorld, drawSegment,
            drawAxesExact, drawHandle, drawLabel, drawFoci } = H;

    const col = getColors();
    const { a, b } = params();
    const dpr = vp.dpr || 1;

    if (!state._pbAngles || state._pbAngles.length !== 6)
      state._pbAngles = defaultAngles();
    if (state._pbDrag == null) state._pbDrag = -1;

    ensureListeners(ctx.canvas);

    if (state.showAxes) drawAxesExact(ctx, a, b, vp);
    drawHandle(ctx, a, 0, '#ff0000', 'h', 1, vp);
    drawCircleWorld(ctx, 0, 0, a, '#334155', 2, 0.65, vp);
    drawEllipse(ctx, a, b, col.ellipse, col.strokeGrueso, vp);
    if (state.showFoci) drawFoci(ctx, a, b, vp);

    const angles = state._pbAngles;
    const tangs = angles.map(th => tangentAt(th, a, b));
    const SNAP_TOL = 2 / (vp.scale * vp.userZoom);
    const triIndices = [[0, 2, 4], [1, 3, 5]];

    triIndices.forEach((idx, i) => {
      const p1 = tangs[idx[0]], p2 = tangs[idx[1]], p3 = tangs[idx[2]];

      // Puntos en la circunferencia afín
      const ptsC = idx.map(j => ({ x: a * Math.cos(angles[j]), y: a * Math.sin(angles[j]) }));

      // Cálculo de Steiner (Baricentro de los puntos en la elipse)
      const G_ins = {
        x: (p1.pt.x + p2.pt.x + p3.pt.x) / 3,
        y: (p1.pt.y + p2.pt.y + p3.pt.y) / 3
      };
      const isSteiner = Math.hypot(G_ins.x, G_ins.y) < SNAP_TOL;
      const targetG = isSteiner ? { x: 0, y: 0 } : G_ins;

      // --- Circunferencia tenue (Solo en Steiner) ---
      // En este modo, como el triángulo afín es INSCRITO en la de radio 'a',
      // la circunferencia de Steiner es la propia circunferencia de radio 'a'.
      // La dibujamos más marcada o con el color del triángulo para feedback.
      if (isSteiner) {
        ctx.save();
        ctx.strokeStyle = i === 0 ? '#2563eb' : '#dc2626';
        ctx.lineWidth = 0.8 * dpr;
        ctx.globalAlpha = 0.3;
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.arc(vp.X(0), vp.Y(0), a * vp.scale * vp.userZoom, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }

      // 1. Triángulo en CIRCUNFERENCIA (Afín)
      ctx.save();
      ctx.strokeStyle = i === 0 ? '#2563eb' : '#dc2626';
      ctx.lineWidth = isSteiner ? 2.2 * dpr : 1 * dpr;
      ctx.globalAlpha = isSteiner ? 0.9 : 0.4;
      ctx.beginPath();
      ptsC.forEach((p, k) => k === 0 ? ctx.moveTo(vp.X(p.x), vp.Y(p.y)) : ctx.lineTo(vp.X(p.x), vp.Y(p.y)));
      ctx.closePath(); 
      ctx.stroke();
      ctx.restore();

      // 2. Triángulo en ELIPSE - SÓLO RELLENO (Sin contorno)
      ctx.save();
      ctx.fillStyle = i === 0 ? 'rgba(37,99,235,0.08)' : 'rgba(220,38,38,0.08)';
      ctx.beginPath();
      ctx.moveTo(vp.X(p1.pt.x), vp.Y(p1.pt.y));
      ctx.lineTo(vp.X(p2.pt.x), vp.Y(p2.pt.y));
      ctx.lineTo(vp.X(p3.pt.x), vp.Y(p3.pt.y));
      ctx.closePath(); 
      ctx.fill();
      // Se ha eliminado el ctx.stroke() para limpiar la vista.
      ctx.restore();

      // 3. Medianas
      ctx.save();
      ctx.strokeStyle = i === 0 ? '#2563eb' : '#dc2626';
      ctx.lineWidth = 1 * dpr; 
      ctx.globalAlpha = isSteiner ? 0.6 : 0.2;
      [p1.pt, p2.pt, p3.pt].forEach(v => {
        ctx.beginPath();
        ctx.moveTo(vp.X(v.x), vp.Y(v.y));
        ctx.lineTo(vp.X(targetG.x), vp.Y(targetG.y));
        ctx.stroke();
      });
      drawPoint(ctx, targetG.x, targetG.y,
        isSteiner ? '#fff' : (i === 0 ? '#2563eb' : '#dc2626'),
        isSteiner ? 5*dpr : 3*dpr, false, 1, vp);
      ctx.restore();

      // 4. Líneas de afinidad (Conectoras)
      ctx.save();
      ctx.setLineDash([1*dpr, 3*dpr]); 
      idx.forEach((j, k) => {
        drawSegment(ctx, ptsC[k], tangs[j].pt, '#475569', 1.3, 0.5, vp);
      });
      ctx.restore();

      // Puntos de la circunferencia afín
      idx.forEach((j, k) => {
        drawPoint(ctx, ptsC[k].x, ptsC[k].y, '#64748b', 3.5*dpr, true, 0.85, vp);
      });
    });

    // Puntos arrastrables en la elipse
    for (let i = 0; i < 6; i++) {
      drawDraggable(ctx, tangs[i].pt.x, tangs[i].pt.y, PT_COLORS[i], vp, state._pbDrag === i);
    }
  });
})();