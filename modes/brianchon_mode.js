/**
 * Modo: brianchon
 * 
 * 6 tangentes a la elipse (definidas por los mismos puntos que Pascal)
 * → hexágono circunscrito → punto de Brianchon.
 * Comparte state._pbAngles con el modo pascal.
 */
(function () {
  if (!window.ElipseLab) return;

  const Lab = window.ElipseLab;
  const TAU = Math.PI * 2;

  const COL_BRIANCHON = '#dc2626';
  const COL_OPP       = ['#f59e0b', '#10b981', '#8b5cf6'];
  const COL_TANGENT   = '#94a3b8';
  const PT_COLORS = ['#dc2626','#dc2626','#dc2626','#dc2626','#dc2626','#dc2626'];

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

  function ensureListeners(canvas, modeId) {
    const key = `_pbBound_${modeId}`;
    if (Lab.state[key]) return;
    Lab.state[key] = true;

    function isActive() {
      return (Lab.state.activeLayers || []).includes(modeId);
    }

    const onDown = (ev) => {
      if (!isActive()) return;
      const vp = Lab.viewport;
      const rect = canvas.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const my = (ev.clientY - rect.top)  * (canvas.height / rect.height);
      const a = Lab.state.a, b = Lab.state.b;
      const angles = Lab.state._pbAngles || defaultAngles();
      const tol = 18 * (vp.dpr || 1);
      let hit = -1;
      for (let i = 0; i < 6; i++) {
        const px = vp.toCSSX(a*Math.cos(angles[i])) * (vp.dpr||1);
        const py = vp.toCSSY(b*Math.sin(angles[i])) * (vp.dpr||1);
        if (Math.hypot(mx-px, my-py) < tol) { hit = i; break; }
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
      Lab.state._pbAngles = angles;
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

  Lab.registerMode('brianchon', (ctx, state, H) => {
    const { viewport: vp, getColors, params,
            drawSegment, drawPoint, drawEllipse,
            drawAxesExact, drawHandle, drawLabel, drawFoci } = H;

    const col = getColors();
    const { a, b } = params();
    const dpr = vp.dpr || 1;

    if (!state._pbAngles || state._pbAngles.length !== 6)
      state._pbAngles = defaultAngles();
    if (state._pbDrag == null) state._pbDrag = -1;

    ensureListeners(ctx.canvas, 'brianchon');

    if (state.showAxes) drawAxesExact(ctx, a, b, vp);
    drawHandle(ctx, a, 0, '#ff0000', 'h', 1, vp);
    drawEllipse(ctx, a, b, col.ellipse, col.strokeGrueso, vp);

    const angles = state._pbAngles;
    const ext = Math.max(a, b) * 3;

    // Tangentes en cada punto
    const tangs = angles.map(th => tangentAt(th, a, b));

    // Vértices del hexágono: intersección de tangentes consecutivas
    const verts = [];
    for (let i = 0; i < 6; i++) {
      const t1 = tangs[i], t2 = tangs[(i+1)%6];
      const v = lineIntersect(
        t1.pt.x, t1.pt.y, t1.dx, t1.dy,
        t2.pt.x, t2.pt.y, t2.dx, t2.dy
      );
      verts.push(v);
    }

  // --- TANGENTES PROLONGADAS (PICOS CERCANOS + PICOS OPUESTOS) ---
    for (let i = 0; i < 6; i++) {
      const tActual = tangs[i];
      
      // 1. Intersección con vecinas inmediatas (forman el hexágono base)
      const pPrevia = lineIntersect(tActual.pt.x, tActual.pt.y, tActual.dx, tActual.dy,
                                    tangs[(i+5)%6].pt.x, tangs[(i+5)%6].pt.y, tangs[(i+5)%6].dx, tangs[(i+5)%6].dy);
      const pSig   = lineIntersect(tActual.pt.x, tActual.pt.y, tActual.dx, tActual.dy,
                                    tangs[(i+1)%6].pt.x, tangs[(i+1)%6].pt.y, tangs[(i+1)%6].dx, tangs[(i+1)%6].dy);

      // 2. Intersección con vecinas de segundo grado (tu estrella original: pares/impares)
      const pEstrella1 = lineIntersect(tActual.pt.x, tActual.pt.y, tActual.dx, tActual.dy,
                                       tangs[(i+4)%6].pt.x, tangs[(i+4)%6].pt.y, tangs[(i+4)%6].dx, tangs[(i+4)%6].dy);
      const pEstrella2 = lineIntersect(tActual.pt.x, tActual.pt.y, tActual.dx, tActual.dy,
                                       tangs[(i+2)%6].pt.x, tangs[(i+2)%6].pt.y, tangs[(i+2)%6].dx, tangs[(i+2)%6].dy);

      // 3. Intersección con la OPUESTA (el pico de la línea de Brianchon: 1-4, 2-5, 3-6)
      const pOpuesta = lineIntersect(tActual.pt.x, tActual.pt.y, tActual.dx, tActual.dy,
                                     tangs[(i+3)%6].pt.x, tangs[(i+3)%6].pt.y, tangs[(i+3)%6].dx, tangs[(i+3)%6].dy);

      // Metemos todos los puntos válidos en un array para encontrar los extremos
      const candidates = [pPrevia, pSig, pEstrella1, pEstrella2, pOpuesta].filter(p => p !== null);

      if (candidates.length >= 2) {
        // Encontramos los dos puntos más alejados entre sí en la dirección de la tangente
        // para asegurar que la línea pase por TODOS los picos.
        let minT = Infinity, maxT = -Infinity;
        candidates.forEach(p => {
          const t = (p.x - tActual.pt.x) * tActual.dx + (p.y - tActual.pt.y) * tActual.dy;
          if (t < minT) minT = t;
          if (t > maxT) maxT = t;
        });

        const startPt = { x: tActual.pt.x + tActual.dx * minT, y: tActual.pt.y + tActual.dy * minT };
        const endPt   = { x: tActual.pt.x + tActual.dx * maxT, y: tActual.pt.y + tActual.dy * maxT };

        drawSegment(ctx, startPt, endPt, COL_TANGENT, dpr, 0.4, vp);
      } else {
        // Fallback por si acaso
        drawExtendedLine(ctx, tActual.pt, {x: tActual.pt.x + tActual.dx, y: tActual.pt.y + tActual.dy}, 
                         COL_TANGENT, dpr, 0.3, vp, ext);
      }
    }
    // --- LADOS DEL HEXÁGONO CIRCUNSCRITO (SIN COLOR) ---
    for (let i = 0; i < 6; i++) {
      const va = verts[i], vb = verts[(i+1)%6];
      if (va && vb) {
        // Usamos COL_TANGENT para que sea uniforme con el resto de la estructura
        // pero con un poco más de grosor (1.5) para definir el hexágono base.
        drawSegment(ctx, va, vb, COL_TANGENT, 1.5 * dpr, 0.8, vp);
      }
    }

    // --- DIAGONALES PRINCIPALES LIMITADAS AL HEXÁGONO ---
    const diagPairs = [[0,3], [1,4], [2,5]];
    for (let i = 0; i < 3; i++) {
      const [ia, ib] = diagPairs[i];
      const va = verts[ia], vb = verts[ib];
      
      if (va && vb) {
        // En lugar de drawExtendedLine, usamos drawSegment para que 
        // la línea muera exactamente en los vértices del hexágono.
        drawSegment(ctx, va, vb, COL_OPP[i], 2 * dpr, 0.8, vp);
      }
    }

    // Punto de Brianchon
    let B_pt = null;
    if (verts[0] && verts[3] && verts[1] && verts[4]) {
      const d03x = verts[3].x-verts[0].x, d03y = verts[3].y-verts[0].y;
      const d14x = verts[4].x-verts[1].x, d14y = verts[4].y-verts[1].y;
      B_pt = lineIntersect(
        verts[0].x, verts[0].y, d03x, d03y,
        verts[1].x, verts[1].y, d14x, d14y
      );
    }

    if (B_pt) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = COL_BRIANCHON;
      ctx.beginPath(); ctx.arc(vp.X(B_pt.x), vp.Y(B_pt.y), 4*dpr, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2*dpr; ctx.stroke();
      ctx.restore();
      const off = 16 / (vp.scale * vp.userZoom);
    }

    // Puntos de tangencia arrastrables + etiquetas
    for (let i = 0; i < 6; i++) {
      const pt = tangs[i].pt;
      drawDraggable(ctx, pt.x, pt.y, PT_COLORS[0], vp, state._pbDrag === i);
      const off = 15 / (vp.scale * vp.userZoom);
      const nx = Math.cos(angles[i]), ny = Math.sin(angles[i]);
      drawLabel(ctx,
        vp.X(pt.x + nx*off), vp.Y(pt.y + ny*off),
        String(i+1),
        { size: 10, bold: true, color: PT_COLORS[0], align: 'center' }, vp);   
    }
    // --- BLOQUE DE FOCOS ---
    if (state.showFoci) {
      drawFoci(ctx, a, b, vp);
    }
    // -----------------------
  });
})();