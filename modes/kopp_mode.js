/**
 * KOPP — Ruedas pequeñas, orientación libre, dial HUD en canvas
 * ──────────────────────────────────────────────────────────────────────────────
 * El dial se dibuja directamente en el canvas del core (como circunferencia_afin),
 * así desaparece solo cuando el modo no está activo. Los eventos usan
 * capture:true para interceptarlos antes que el core.
 *
 * LOCK-SIZE: R, k, L calculados con a_ref=A_MAX y congelados.
 * Línea diametral Ca–Cb (pasa por el origen) visible solo al arrastrar el dial.
 *
 * state.koppAngle     → θ en radianes. Default 0 (grúa a la derecha).
 * state.koppGapFactor → gap relativo rueda/elipse. Default 0.12.
 * state.koppHminPx    → altura mínima de M1 en px. Default 6.
 * state.showFoci      → si true, dibuja los focos (requiere botón en index).
 */
(function () {
  if (!window.ElipseLab) return;
  const G = window.ElipseLab;

  // ── Utilidades geométricas ──────────────────────────────────────────────────
  function rot(p, theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    return { x: c * p.x - s * p.y, y: s * p.x + c * p.y };
  }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }

  const TAU = Math.PI * 2;

  // ── Dial HUD — idéntico a Conjugados (forma, tamaño, colores + halo/sombra) ─
  // Geometría y paleta iguales que en Conjugados
  const DIAL_MARGIN = 16;   // margen sup./dcha. (px CSS)
  const DIAL_R_CSS  = 40;   // radio del dial (px CSS) — igual que Conjugados
  const KNOB_R_CSS  = 5;    // radio del knob (px CSS)
  const DIAL_GRAY   = 'rgba(156,163,175,0.35)'; // cara del dial (Conjugados)
  const AFF_CIRC_COLOR = '#9c9c9c';             // knob (Conjugados)

  // Efectos visuales (iguales al parche de Conjugados)
  const DIAL_SHADOW_COLOR = 'rgba(0,0,0,0.35)';
  const DIAL_SHADOW_BLUR  = 16;   // px lógicos; se escalan por dpr
  const DIAL_SHADOW_OFFY  = 2;    // desplazamiento vertical sutil
  const DIAL_HALO_OUTER   = 12;   // halo exterior (px)
  const DIAL_HALO_ALPHA   = 0.25; // opacidad máxima del halo en el borde

  // Geometría del dial (esquina superior derecha, en px CSS)
  function dialGeom(canvas) {
    const w = canvas.clientWidth;
    const cx = w - DIAL_MARGIN - DIAL_R_CSS;
    const cy = DIAL_MARGIN + DIAL_R_CSS;
    return { cx, cy, R: DIAL_R_CSS, rKnob: KNOB_R_CSS };
  }

  // Dial con halo + sombra (sin “radio” interior, como en Conjugados)
  function drawDialHUD(ctx, vp, theta /* col no requerido */) {
    const dpr = vp.dpr || 1;
    const g   = dialGeom(ctx.canvas);

    // Trabajar en píxeles de pantalla
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // (B) HALO RADIAL exterior — debajo del disco
    {
      const R0  = g.R;
      const R1  = g.R + DIAL_HALO_OUTER;
      const grd = ctx.createRadialGradient(g.cx, g.cy, R0*0.98, g.cx, g.cy, R1);
      grd.addColorStop(0.00, 'rgba(0,0,0,0.00)');
      grd.addColorStop(0.35, 'rgba(0,0,0,0.06)');
      grd.addColorStop(0.70, `rgba(0,0,0,${DIAL_HALO_ALPHA*0.6})`);
      grd.addColorStop(1.00, `rgba(0,0,0,${DIAL_HALO_ALPHA})`);
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, R1, 0, TAU);
      ctx.fillStyle = grd;
      ctx.fill();
    }

    // (A) SOMBRA real usando shadowBlur — debajo del disco
    {
      ctx.save();
      ctx.shadowColor   = DIAL_SHADOW_COLOR;
      ctx.shadowBlur    = DIAL_SHADOW_BLUR * dpr; // escalar por dpr
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = DIAL_SHADOW_OFFY * dpr;

      // “Relleno fantasma” para depositar sombra
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, g.R + 1, 0, TAU);
      ctx.fillStyle = 'rgba(0,0,0,0.001)';
      ctx.fill();
      ctx.restore();
    }

    // Disco gris del dial
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.R, 0, TAU);
    ctx.fillStyle = DIAL_GRAY;
    ctx.fill();

    // Knob en el borde (OJO: theta está en convención Y↑ → invertimos seno)
    const ang = ((theta % TAU) + TAU) % TAU;
    const kx  = g.cx + Math.cos(ang) * g.R;
    const ky  = g.cy - Math.sin(ang) * g.R; // Y de pantalla
    ctx.fillStyle = AFF_CIRC_COLOR;
    ctx.beginPath();
    ctx.arc(kx, ky, g.rKnob, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  // ── Listeners del dial (registrados una vez por canvas) ────────────────────
  function ensureDialListeners(canvas) {
    if (G.state._koppHudBound) return;
    G.state._koppHudBound = true;

    function angleFromEvent(ev) {
      const rect = canvas.getBoundingClientRect();
      const mx   = ev.clientX - rect.left;
      const my   = ev.clientY - rect.top;
      const g    = dialGeom(canvas);
      // CSS Y↓ → mundo Y↑: negamos dy
      return Math.atan2(-(my - g.cy), mx - g.cx);
    }

    function hitDial(ev) {
      const rect = canvas.getBoundingClientRect();
      const mx   = ev.clientX - rect.left;
      const my   = ev.clientY - rect.top;
      const g    = dialGeom(canvas);
      return Math.hypot(mx - g.cx, my - g.cy) <= g.R + KNOB_R_CSS + 6;
    }

    canvas.addEventListener('pointerdown', (ev) => {
      if (!G.state.activeLayers?.includes('kopp')) return;
      if (!hitDial(ev)) return;
      ev.preventDefault();
      ev.stopPropagation();
      G.state._koppDrag = true;
      canvas.setPointerCapture?.(ev.pointerId);
      G.state.koppAngle = angleFromEvent(ev);
      G._redraw?.();
    }, { capture: true });

    canvas.addEventListener('pointermove', (ev) => {
      if (!G.state._koppDrag) return;
      ev.preventDefault();
      ev.stopPropagation();
      G.state.koppAngle = angleFromEvent(ev);
      G._redraw?.();
    }, { capture: true });

    canvas.addEventListener('pointerup', (ev) => {
      if (!G.state._koppDrag) return;
      G.state._koppDrag = false;
      canvas.releasePointerCapture?.(ev.pointerId);
      G._redraw?.();   // redibuja para ocultar la línea diametral
    }, { capture: true });

    canvas.addEventListener('pointercancel', () => {
      if (!G.state._koppDrag) return;
      G.state._koppDrag = false;
      G._redraw?.();
    }, { capture: true });
  }

  // ── Modo Kopp ───────────────────────────────────────────────────────────────
  G.registerMode('kopp', (ctx, state, helpers) => {
    const {
      viewport: vp, getColors, params,
      drawSegment, drawPoint, drawCircleWorld,
      clamp01, drawHandle, drawFoci,
    } = helpers;

    const { a, b } = params();
    const col = getColors();
    const t   = Number(state.t || 0);
    const showFoci = (state.showFoci === true);

    // ── Parámetros ────────────────────────────────────────────────────────────
    const gapFactor = Number(state.koppGapFactor ?? 0.12);
    const theta     = Number(state.koppAngle     ?? 0);
    const hMinPx    = Number(state.koppHminPx    ?? 6);

    // ── Listeners (una vez) ───────────────────────────────────────────────────
    ensureDialListeners(ctx.canvas);

    // ── LOCK-SIZE ─────────────────────────────────────────────────────────────
    const eps  = 1e-9;
    const bAbs = Math.abs(b);
    const aAbs = Math.abs(a);
    const E_MAX = 0.9642;
    const aRef  = bAbs / Math.sqrt(Math.max(eps, 1 - E_MAX * E_MAX));

    G._koppM = G._koppM || {};
    const memo    = G._koppM;
    const memoKey = `${gapFactor.toFixed(4)}_${bAbs.toFixed(2)}`;

    if (memo.key !== memoKey) {
      const gap_ref = gapFactor * bAbs;
      const k0      = 5.36;
      const R0      = (aRef + gap_ref) / Math.max(eps, 2 * k0 - 1);
      const ra_ref  = (aRef + bAbs) / (2 * (1 + k0));
      const rb_ref  = (aRef - bAbs) / (2 * k0);
      memo.key = memoKey;
      memo.R   = R0;
      memo.k   = k0;
      memo.L   = 1.05 * 0.5 * (2 * R0 + ra_ref + rb_ref);
    }

    const R = memo.R;
    const k = memo.k;
    const L = memo.L;

    const ra = (aAbs + bAbs) / (2 * (1 + k));
    const rb = Math.max(0, (aAbs - bAbs) / (2 * k));

    // ── Centros ───────────────────────────────────────────────────────────────
    const offsetX = (1 + 2 * k) * R;
    const Ca = rot({ x: -R + offsetX, y: 0 }, theta);
    const Cb = rot({ x:  R + offsetX, y: 0 }, theta);

    const hMinW = hMinPx / (vp.scale * (vp.userZoom || 1));

    // ── Cronología ────────────────────────────────────────────────────────────
    const fApare = clamp01(t / 0.10);
    const fGiro  = clamp01((t - 0.25) / 0.75);
    const phi    = fGiro * Math.PI * 2;

    // ── Cinemática ────────────────────────────────────────────────────────────
    const uA_loc = phi - theta;
    const uB_loc = Math.PI - phi - theta;

    const A = add(Ca, rot({ x: ra * Math.cos(uA_loc), y: ra * Math.sin(uA_loc) }, theta));
    const B = add(Cb, rot({ x: rb * Math.cos(uB_loc), y: rb * Math.sin(uB_loc) }, theta));

    const dx = B.x - A.x, dy = B.y - A.y;
    const distAB = Math.hypot(dx, dy);
    const hRaw   = Math.sqrt(Math.max(0, L * L - (distAB / 2) ** 2));
    const h      = Math.max(hRaw, hMinW);

    const midX = A.x + dx / 2, midY = A.y + dy / 2;
    const nx = -dy / (distAB || 1), ny = dx / (distAB || 1);
    const M1 = { x: midX + nx * h, y: midY + ny * h };

    const M = { x: A.x + (M1.x - B.x) * k, y: A.y + (M1.y - B.y) * k };
    const C = { x: A.x + (A.x  - B.x) * k, y: A.y + (A.y  - B.y) * k };
    const P = { x: M1.x + (M.x - A.x),      y: M1.y + (M.y - A.y)    };

    // ── Ejes / Diámetros de la elipse ────────────────────────────────────────
    const diamAlpha = state.showAxes ? 1 : clamp01(1 - t / 0.25);
    if (state.showAxes || diamAlpha > 0) {
      drawSegment(ctx, { x: -a, y: 0 }, { x: a, y: 0 }, col.axis, col.strokeFino, diamAlpha, vp);
      drawSegment(ctx, { x: 0, y: -b }, { x: 0, y:  b }, col.axis, col.strokeFino, diamAlpha, vp);
    }

    // ── Tirador rojo ──────────────────────────────────────────────────────────
    drawHandle(ctx, a, 0, '#ff0000', 'h', 1, vp);

    // ── Focos (a discreción con el botón "Focos") ─────────────────────────────
    if (showFoci) {
      drawFoci(ctx, a, b, vp);
    }

    // ── Línea diametral Ca–Cb (solo durante arrastre) — a trazos y color de ruedas
    if (state._koppDrag && fApare > 0) {
      ctx.save();
      ctx.globalAlpha = 0.60;
      const gris = col.faint;                       // mismo color que las ruedas
      ctx.strokeStyle = gris;
      ctx.lineWidth   = 1.2 * (vp.dpr || 1);
      ctx.setLineDash([5 * (vp.dpr || 1), 4 * (vp.dpr || 1)]);
      ctx.beginPath();
      ctx.moveTo(vp.X(Ca.x), vp.Y(Ca.y));
      ctx.lineTo(vp.X(0),    vp.Y(0));
      ctx.lineTo(vp.X(Cb.x), vp.Y(Cb.y));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.80;
      ctx.beginPath();
      ctx.arc(vp.X(0), vp.Y(0), 3 * (vp.dpr || 1), 0, TAU);
      ctx.fillStyle = gris;
      ctx.fill();
      ctx.restore();
    }

    // ── Mecanismo ─────────────────────────────────────────────────────────────
    if (fApare > 0) {
      ctx.save();
      ctx.globalAlpha = fApare;

      const lw   = 1.2 * (vp.dpr || 1);
      const gris = col.faint;

      // Rastro de C
      if (fGiro > 0) {
        ctx.beginPath();
        ctx.strokeStyle = col.ellipse;
        ctx.lineWidth   = 3 * (vp.dpr || 1);
        const du = 0.02;
        for (let u = 0; u <= phi + 1e-9; u += du) {
          const uAu = u - theta, uBu = Math.PI - u - theta;
          const Av  = add(Ca, rot({ x: ra * Math.cos(uAu), y: ra * Math.sin(uAu) }, theta));
          const Bv  = add(Cb, rot({ x: rb * Math.cos(uBu), y: rb * Math.sin(uBu) }, theta));
          const Cx  = Av.x + (Av.x - Bv.x) * k;
          const Cy  = Av.y + (Av.y - Bv.y) * k;
          if (u === 0) ctx.moveTo(vp.X(Cx), vp.Y(Cy));
          else         ctx.lineTo(vp.X(Cx), vp.Y(Cy));
        }
        ctx.stroke();
      }

      // Ruedas
      drawCircleWorld(ctx, Ca.x, Ca.y, R, gris, lw, 1, vp);
      drawCircleWorld(ctx, Cb.x, Cb.y, R, gris, lw, 1, vp);

      // Diámetros de las ruedas
      const dirA = rot({ x: Math.cos(uA_loc), y: Math.sin(uA_loc) }, theta);
      const dirB = rot({ x: Math.cos(uB_loc), y: Math.sin(uB_loc) }, theta);
      drawSegment(ctx,
        { x: Ca.x - R * dirA.x, y: Ca.y - R * dirA.y },
        { x: Ca.x + R * dirA.x, y: Ca.y + R * dirA.y },
        gris, lw, 1, vp);
      drawSegment(ctx,
        { x: Cb.x - R * dirB.x, y: Cb.y - R * dirB.y },
        { x: Cb.x + R * dirB.x, y: Cb.y + R * dirB.y },
        gris, lw, 1, vp);

      // Cubos (centros de ruedas)
      drawPoint(ctx, Ca.x, Ca.y, gris, 2.2 * (vp.dpr || 1), false, 1, vp);
      drawPoint(ctx, Cb.x, Cb.y, gris, 2.2 * (vp.dpr || 1), false, 1, vp);

      // Barras — mismo color mecánico que en Kleiber
      const colBarra = col.barColor;
      [[A, M1], [B, M1], [A, M], [C, M], [M1, P], [M, P]].forEach(([p, q]) =>
        drawSegment(ctx, p, q, colBarra, lw * 2, 0.9, vp)
      );

      // Nodos de las barras
      [A, B, M1, M, P].forEach(p =>
        drawPoint(ctx, p.x, p.y, colBarra, 3 * (vp.dpr || 1), false, 1, vp)
      );

      // Punto C (el trazador sobre la elipse)
      drawPoint(ctx, C.x, C.y, col.ellipse, 6 * (vp.dpr || 1), true, 1, vp);

      ctx.restore();
    }

    // ── Aviso círculo (rb = 0) ────────────────────────────────────────────────
    if (rb <= 0 && typeof helpers.drawLabel === 'function') {
      const px = vp.X(0), py = vp.Y(-bAbs) - 18 * (vp.dpr || 1);
      helpers.drawLabel(ctx, px, py,
        'Kopp requiere a > b (elipse, no círculo)',
        { align: 'center', baseline: 'bottom', size: 12, bold: false,
          color: col.label, alpha: 0.85 }, vp);
    }

    // ── Dial HUD (encima de todo, último) ─────────────────────────────────────
    drawDialHUD(ctx, vp, theta);
  });
})();