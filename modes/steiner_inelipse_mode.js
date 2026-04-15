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
      const f  = dx*dex + dy*dey;
      const fp = dex*dex + dey*dey + dx*d2ex + dy*d2ey;
      if (Math.abs(fp) < 1e-12) break;
      theta -= f / fp;
    }
    return theta;
  }

  function lineIntersect(px, py, dx, dy, qx, qy, ex, ey) {
    const denom = dx*ey - dy*ex;
    if (Math.abs(denom) < 1e-10) return null;
    const t = ((qx-px)*ey - (qy-py)*ex) / denom;
    return { x: px + t*dx, y: py + t*dy };
  }

  function tangentAt(theta, a, b) {
    const px = a*Math.cos(theta), py = b*Math.sin(theta);
    const dx = -a*Math.sin(theta), dy = b*Math.cos(theta);
    const len = Math.sqrt(dx*dx+dy*dy)||1;
    return { pt: {x:px, y:py}, dx: dx/len, dy: dy/len };
  }

  function ensureListeners(canvas) {
    if (Lab.state._pbBound_steiner_in) return;
    Lab.state._pbBound_steiner_in = true;

    function isActive() {
      return (Lab.state.activeLayers || []).includes('steiner_inelipse');
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
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5*dpr; ctx.globalAlpha = 1; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 1.2*dpr; ctx.globalAlpha = 1;
    ctx.setLineDash([3*dpr, 3*dpr]);
    ctx.beginPath(); ctx.arc(vp.X(x), vp.Y(y), r + 5*dpr, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  Lab.registerMode('steiner_inelipse', (ctx, state, H) => {
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
    const triIndices = [[0, 2, 4], [1, 3, 5]];

    triIndices.forEach((idx, i) => {
      const p1 = tangs[idx[0]], p2 = tangs[idx[1]], p3 = tangs[idx[2]];

      const SNAP_TOL = 2 / (vp.scale * vp.userZoom);
      const G_ins = {
        x: (p1.pt.x + p2.pt.x + p3.pt.x) / 3,
        y: (p1.pt.y + p2.pt.y + p3.pt.y) / 3
      };
      const isSteiner = Math.hypot(G_ins.x, G_ins.y) < SNAP_TOL;

      // 1. Triángulo afín
      const tC = idx.map(j => {
        const c = Math.cos(angles[j]), s = Math.sin(angles[j]);
        return { pt: {x: a*c, y: a*s}, dx: -s, dy: c };
      });
      const vC = [
        lineIntersect(tC[0].pt.x, tC[0].pt.y, tC[0].dx, tC[0].dy, tC[1].pt.x, tC[1].pt.y, tC[1].dx, tC[1].dy),
        lineIntersect(tC[1].pt.x, tC[1].pt.y, tC[1].dx, tC[1].dy, tC[2].pt.x, tC[2].pt.y, tC[2].dx, tC[2].dy),
        lineIntersect(tC[2].pt.x, tC[2].pt.y, tC[2].dx, tC[2].dy, tC[0].pt.x, tC[0].pt.y, tC[0].dx, tC[0].dy)
      ];

      // --- Circunferencia tenue (Solo Steiner) ---
      if (isSteiner && vC.every(v => v)) {
        ctx.save();
        const radiusC = Math.hypot(vC[0].x, vC[0].y);
        ctx.strokeStyle = i === 0 ? '#2563eb' : '#dc2626';
        ctx.lineWidth = 0.8 * dpr;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(vp.X(0), vp.Y(0), radiusC * vp.scale * vp.userZoom, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }

      // 2. Dibujo del Triángulo Afín (Circunferencia)
      ctx.save();
      if (vC.every(v => v)) {
        ctx.strokeStyle = i === 0 ? '#2563eb' : '#dc2626';
        ctx.lineWidth = isSteiner ? 2.2 * dpr : 1 * dpr; 
        ctx.globalAlpha = isSteiner ? 0.9 : 0.6;
        ctx.beginPath();
        ctx.moveTo(vp.X(vC[0].x), vp.Y(vC[0].y));
        ctx.lineTo(vp.X(vC[1].x), vp.Y(vC[1].y));
        ctx.lineTo(vp.X(vC[2].x), vp.Y(vC[2].y));
        ctx.closePath(); ctx.stroke();
      }
      ctx.restore();

      // 3. Triángulo de la Elipse (Tangentes) - SÓLO RELLENO
      const vE = [
        lineIntersect(p1.pt.x, p1.pt.y, p1.dx, p1.dy, p2.pt.x, p2.pt.y, p2.dx, p2.dy),
        lineIntersect(p2.pt.x, p2.pt.y, p2.dx, p2.dy, p3.pt.x, p3.pt.y, p3.dx, p3.dy),
        lineIntersect(p3.pt.x, p3.pt.y, p3.dx, p3.dy, p1.pt.x, p1.pt.y, p1.dx, p1.dy)
      ];

      ctx.save();
      if (vE.every(v => v)) {
        // Mantenemos el relleno tenue (0.05 de opacidad)
        ctx.fillStyle = i === 0 ? 'rgba(37,99,235,0.05)' : 'rgba(220,38,38,0.05)';
        ctx.beginPath();
        ctx.moveTo(vp.X(vE[0].x), vp.Y(vE[0].y));
        ctx.lineTo(vp.X(vE[1].x), vp.Y(vE[1].y));
        ctx.lineTo(vp.X(vE[2].x), vp.Y(vE[2].y));
        ctx.closePath();
        ctx.fill(); // Rellenamos el área
        
        // --- ELIMINADO EL CONTORNO ---
        // ctx.strokeStyle = i === 0 ? '#2563eb' : '#dc2626';
        // ctx.lineWidth = 1.3 * dpr; 
        // ctx.globalAlpha = isSteiner ? 0.8 : 0.45;
        // ctx.stroke(); // <--- Esta línea es la que se ha eliminado
        // ------------------------------

        // Mantenemos las líneas conectoras vC -> vE porque son discontinuas y ayudan
        if (vC.every(v => v)) {
          ctx.save();
          ctx.setLineDash([1*dpr, 3*dpr]); 
          vC.forEach((ptC, k) => {
            if (vE[k]) drawSegment(ctx, ptC, vE[k], '#475569', 1.3, 0.8, vp);
          });
          ctx.restore();
        }
      }
      ctx.restore();

      // Puntos y medianas
      const ptsC = idx.map(j => ({ x: a * Math.cos(angles[j]), y: a * Math.sin(angles[j]) }));
      ptsC.forEach(p => drawPoint(ctx, p.x, p.y, '#64748b', 3.5*dpr, true, 0.85, vp));

      ctx.save();
      ctx.setLineDash([1*dpr, 3*dpr]);
      idx.forEach((j, k) => {
        drawSegment(ctx, ptsC[k], tangs[j].pt, '#475569', 1.3, 0.5, vp);
      });
      ctx.restore();

      const targetG = isSteiner ? { x: 0, y: 0 } : G_ins;
      ctx.save();
      ctx.strokeStyle = i === 0 ? '#2563eb' : '#dc2626';
      ctx.lineWidth = 1 * dpr; 
      ctx.globalAlpha = isSteiner ? 0.6 : 0.2;
      [p1.pt, p2.pt, p3.pt].forEach(v => {
        ctx.beginPath(); ctx.moveTo(vp.X(v.x), vp.Y(v.y));
        ctx.lineTo(vp.X(targetG.x), vp.Y(targetG.y)); ctx.stroke();
      });
      drawPoint(ctx, targetG.x, targetG.y,
        isSteiner ? '#fff' : (i === 0 ? '#2563eb' : '#dc2626'),
        isSteiner ? 5 * dpr : 3 * dpr, false, 1, vp);
      ctx.restore();
    });

    for (let i = 0; i < 6; i++) {
      drawDraggable(ctx, tangs[i].pt.x, tangs[i].pt.y, PT_COLORS[i], vp, state._pbDrag === i);
    }
  });
})();