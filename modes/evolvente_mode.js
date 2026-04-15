/**
 * Modo: evolvente (Recta engranada horizontal)
 * * La elipse se mantiene quieta.
 * * La recta comienza horizontal en el vértice inferior (E2 en contacto).
 * * La recta termina horizontal en el vértice inferior (E1 en contacto).
 * * Se mantiene el punto arrastrable y la interacción.
 * * Incluye rastro de: Punto azul, Centro y ambos Focos.
 */
(function () {
  if (!window.ElipseLab) return;

  const Lab = window.ElipseLab;
  const TAU = Math.PI * 2;

  // ── Tabla de arco de la elipse ────────────────────────────────────────────
  function buildArcTable(a, b, N) {
    const table = new Float64Array(N + 1);
    let arc = 0;
    for (let i = 0; i < N; i++) {
      const t1 = i * TAU / N, t2 = (i + 1) * TAU / N;
      const dx = a * Math.cos(t2) - a * Math.cos(t1);
      const dy = b * Math.sin(t2) - b * Math.sin(t1);
      arc += Math.sqrt(dx * dx + dy * dy);
      table[i + 1] = arc;
    }
    return table;
  }

  function arcAt(table, t, N) {
    t = ((t % TAU) + TAU) % TAU;
    const idx = t / TAU * N;
    const i0 = Math.floor(idx) % N;
    const i1 = (i0 + 1) % N;
    const frac = idx - Math.floor(idx);
    const a1 = i1 === 0 ? table[N] : table[i1];
    return table[i0] + frac * (a1 - table[i0]);
  }

  // ── Arrastre del punto libre ──────────────────────────────────────────────
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

  function ensureListeners(canvas) {
    if (Lab.state._evolBound) return;
    Lab.state._evolBound = true;

    function isActive() {
      return (Lab.state.activeLayers || []).includes('evolvente');
    }

    const onDown = (ev) => {
      if (!isActive()) return;
      const vp = Lab.viewport;
      const rect = canvas.getBoundingClientRect();
      const mxCSS = ev.clientX - rect.left;
      const myCSS = ev.clientY - rect.top;
      const a = Lab.state.a, b = Lab.state.b;
      const tol = 20;

      // Comprobar punto de inicio (verde)
      const startAng = Lab.state._evolStart ?? (3 * Math.PI / 2);
      const spx = vp.toCSSX(a * Math.cos(startAng));
      const spy = vp.toCSSY(b * Math.sin(startAng));
      if (Math.hypot(mxCSS - spx, myCSS - spy) < tol) {
        ev.preventDefault(); ev.stopPropagation();
        Lab.state._evolDragStart = true;
        canvas.setPointerCapture?.(ev.pointerId);
        Lab._redraw?.();
        return;
      }

      // Comprobar punto libre (azul)
      const ang = Lab.state._evolAngle ?? Math.PI / 4;
      const px = vp.toCSSX(a * Math.cos(ang));
      const py = vp.toCSSY(b * Math.sin(ang));
      if (Math.hypot(mxCSS - px, myCSS - py) < tol) {
        ev.preventDefault(); ev.stopPropagation();
        Lab.state._evolDrag = true;
        canvas.setPointerCapture?.(ev.pointerId);
        Lab._redraw?.();
      }
    };

    const onMove = (ev) => {
      if (!isActive()) return;
      const vp = Lab.viewport;
      const rect = canvas.getBoundingClientRect();
      const wx = vp.toWorldX(ev.clientX - rect.left);
      const wy = vp.toWorldY(ev.clientY - rect.top);

      if (Lab.state._evolDragStart) {
        ev.preventDefault(); ev.stopPropagation();
        Lab.state._evolStart = projectToEllipse(wx, wy, Lab.state.a, Lab.state.b);
        Lab._redraw?.();
        return;
      }
      if (Lab.state._evolDrag) {
        ev.preventDefault(); ev.stopPropagation();
        Lab.state._evolAngle = projectToEllipse(wx, wy, Lab.state.a, Lab.state.b);
        Lab._redraw?.();
      }
    };

    const onUp = (ev) => {
      if (Lab.state._evolDragStart) {
        Lab.state._evolDragStart = false;
        canvas.releasePointerCapture?.(ev.pointerId);
        Lab._redraw?.();
        return;
      }
      if (Lab.state._evolDrag) {
        Lab.state._evolDrag = false;
        canvas.releasePointerCapture?.(ev.pointerId);
        Lab._redraw?.();
      }
    };

    // Hover para manita — ambos puntos arrastrables
    canvas.addEventListener('pointermove', (ev) => {
      if (Lab.state._evolDrag || Lab.state._evolDragStart) return;
      if (!isActive()) return;
      const vp = Lab.viewport;
      const rect = canvas.getBoundingClientRect();
      const mxCSS = ev.clientX - rect.left;
      const myCSS = ev.clientY - rect.top;
      const a = Lab.state.a, b = Lab.state.b;
      const tol = 20;
      const ang = Lab.state._evolAngle ?? Math.PI / 4;
      const px = vp.toCSSX(a * Math.cos(ang));
      const py = vp.toCSSY(b * Math.sin(ang));
      const startAng = Lab.state._evolStart ?? (3 * Math.PI / 2);
      const spx = vp.toCSSX(a * Math.cos(startAng));
      const spy = vp.toCSSY(b * Math.sin(startAng));
      if (Math.hypot(mxCSS - px, myCSS - py) < tol ||
          Math.hypot(mxCSS - spx, myCSS - spy) < tol) {
        canvas.style.cursor = 'pointer';
      }
    }, { capture: false });

    canvas.addEventListener('pointerdown',   onDown, { capture: true });
    canvas.addEventListener('pointermove',   onMove, { capture: true });
    canvas.addEventListener('pointerup',     onUp,   { capture: true });
    canvas.addEventListener('pointercancel', onUp,   { capture: true });
  }

  // ══════════════════════════════════════════════════════════════════════════
  Lab.registerMode('evolvente', (ctx, state, H) => {
    const { viewport: vp, getColors, params,
        drawPoint, drawEllipse, drawSegment, drawFoci,
        drawAxesExact, drawHandle, clamp01 } = H;

    const col = getColors();
    const { a, b } = params();
    const dpr = vp.dpr || 1;
    const N = 1800;

    if (state._evolAngle == null) state._evolAngle = Math.PI / 4;
    if (state._evolStart == null) state._evolStart = 3 * Math.PI / 2; // vértice inferior por defecto
    if (state._evolDrag  == null) state._evolDrag  = false;
    if (state._evolDragStart == null) state._evolDragStart = false;

    ensureListeners(ctx.canvas);

    const cacheKey = `${a}_${b}`;
    if (state._evolCacheKey !== cacheKey) {
      state._evolArcTable  = buildArcTable(a, b, N);
      state._evolCacheKey  = cacheKey;
    }
    const arcTable = state._evolArcTable;
    const totalPeri = arcTable[N];

    // ── Tiempo y Animación de la Recta ──
    const t = state.t || 0;
    const fTravel = clamp01((t - 0.2) / 0.8);
    
    const tStart = state._evolStart;
    const thetaAnim = tStart + fTravel * TAU;
    const fShow = clamp01((t - 0.1) / 0.1);

    // ── Ejes y elipse ──────────────────────────────────────────────────────
    if (state.showAxes) drawAxesExact(ctx, a, b, vp);
    drawHandle(ctx, a, 0, '#ff0000', 'h', 1, vp);
    drawEllipse(ctx, a, b, col.ellipse, col.strokeGrueso, vp);

    const c = Math.sqrt(Math.max(0, a * a - b * b));
    const COL_FOCO   = col.foci;
    const COL_CENTRO = col.label;
    const COL_LIBRE  = '#ff0000';
    const COL_RECTA  = col.barColor; //

    // ── Recta que rueda ────────────────────────────────────────────────────
    if (fShow > 0) {
      const P = { x: a * Math.cos(thetaAnim), y: b * Math.sin(thetaAnim) };
      
      const dxNow = -a * Math.sin(thetaAnim);
      const dyNow = b * Math.cos(thetaAnim);
      const dlenNow = Math.sqrt(dxNow * dxNow + dyNow * dyNow);
      const txNow = dxNow / dlenNow;
      const tyNow = dyNow / dlenNow;
      const nxNow = tyNow, nyNow = -txNow;

      const sNow = fTravel * totalPeri; 

      const endX = P.x - txNow * sNow;
      const endY = P.y - tyNow * sNow;
      const startX = endX + txNow * totalPeri;
      const startY = endY + tyNow * totalPeri;

      // ── Curvas Solidarias ──
      const steps = Math.max(1, Math.round(360 * fTravel));
      const Pd = { x: a * Math.cos(state._evolAngle), y: b * Math.sin(state._evolAngle) };
      
      const pathPd = new Path2D();
      const pathC = new Path2D();
      const pathF1 = new Path2D();
      const pathF2 = new Path2D();

      for (let i = 0; i <= steps; i++) {
        const fi = i / 360;
        const th_i = tStart + fi * TAU;
        const Pi = { x: a * Math.cos(th_i), y: b * Math.sin(th_i) };
        const dxi = -a * Math.sin(th_i), dyi = b * Math.cos(th_i);
        const dli = Math.sqrt(dxi * dxi + dyi * dyi);
        const txi = dxi / dli, tyi = dyi / dli;
        const si = fi * totalPeri;

        // Función auxiliar para transformar puntos a la recta actual
        const transform = (ox, oy) => {
            const vx = ox - Pi.x, vy = oy - Pi.y;
            const lx = vx * txi + vy * tyi;
            const ly = vx * tyi + vy * (-txi);
            return {
                x: vp.X(P.x + (si + lx - sNow) * txNow + ly * nxNow),
                y: vp.Y(P.y + (si + lx - sNow) * tyNow + ly * nyNow)
            };
        };

        const ptPd = transform(Pd.x, Pd.y);
        const ptC  = transform(0, 0);
        const ptF1 = transform(c, 0);
        const ptF2 = transform(-c, 0);

        if (i === 0) {
            pathPd.moveTo(ptPd.x, ptPd.y); pathC.moveTo(ptC.x, ptC.y);
            pathF1.moveTo(ptF1.x, ptF1.y); pathF2.moveTo(ptF2.x, ptF2.y);
        } else {
            pathPd.lineTo(ptPd.x, ptPd.y); pathC.lineTo(ptC.x, ptC.y);
            pathF1.lineTo(ptF1.x, ptF1.y); pathF2.lineTo(ptF2.x, ptF2.y);
        }
      }

      ctx.save();
      // 1. DIBUJAR RASTRO PUNTO ROJO (Pd)
      ctx.strokeStyle = COL_LIBRE; // El rojo que definimos
      ctx.lineWidth = 2 * dpr; 
      ctx.stroke(pathPd);

      // 2. CONFIGURACIÓN PARA RASTROS DISCONTINUOS (Centro y Focos)
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.lineWidth = 1.5 * dpr;

      // Rastro del Centro (O)
      ctx.strokeStyle = COL_CENTRO; 
      ctx.stroke(pathC);

      // Rastro de los Focos
      ctx.strokeStyle = COL_FOCO; 
      ctx.stroke(pathF1); 
      ctx.stroke(pathF2);
      ctx.restore();

      // Dibujo de la recta
      ctx.save();
      ctx.strokeStyle = COL_RECTA;
      ctx.lineWidth = 2.5 * dpr;
      ctx.globalAlpha = 0.8 * fShow;
      ctx.beginPath();
      ctx.moveTo(vp.X(startX), vp.Y(startY));
      ctx.lineTo(vp.X(endX), vp.Y(endY));
      ctx.stroke();    
      ctx.restore();

      drawPoint(ctx, P.x, P.y, col.ellipse, 5 * dpr, true, fShow, vp);
    }

    // ── Punto de inicio arrastrable ─
    const startAng = state._evolStart;
    const startX_pt = a * Math.cos(startAng), startY_pt = b * Math.sin(startAng);
    const rs = state._evolDragStart ? 7 * dpr : 5 * dpr;
    ctx.save();
    ctx.fillStyle = COL_RECTA; ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.arc(vp.X(startX_pt), vp.Y(startY_pt), rs, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * dpr; ctx.globalAlpha = 1; ctx.stroke();
    ctx.strokeStyle = COL_RECTA; ctx.lineWidth = 1.2 * dpr; ctx.globalAlpha = 1;
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.beginPath(); ctx.arc(vp.X(startX_pt), vp.Y(startY_pt), rs + 5 * dpr, 0, TAU); ctx.stroke();
    ctx.restore();

    // ── Punto libre arrastrable ───────────────────────────────────────────
    const ang = state._evolAngle;
    const freeX = a * Math.cos(ang), freeY = b * Math.sin(ang);
    const rr = state._evolDrag ? 7 * dpr : 5 * dpr;
    
    ctx.save();
    ctx.fillStyle = COL_LIBRE; ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.arc(vp.X(freeX), vp.Y(freeY), rr, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
    ctx.strokeStyle = COL_LIBRE; ctx.lineWidth = 1.2 * dpr; ctx.globalAlpha = 1;
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.beginPath(); ctx.arc(vp.X(freeX), vp.Y(freeY), rr + 5 * dpr, 0, TAU); ctx.stroke();
    ctx.restore();

    drawFoci(ctx, a, b, vp);
    drawPoint(ctx,  0, 0, COL_CENTRO, 3.5 * dpr, false, 1,   vp);
  });
})();