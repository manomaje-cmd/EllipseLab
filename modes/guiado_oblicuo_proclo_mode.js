/**
 * Modo: guiado_oblicuo_proclo
 *
 * Con guías en ángulo φ que traza EXACTAMENTE la misma elipse
 * canónica x²/a² + y²/b² = 1 que proclo-arquimedes. Ahora φ se controla con un
 * DIAL HUD (igual que Kopp), con visualización del rango admisible [φ_min, π-φ_min].
 */
(function () {
  if (!window.ElipseLab) return;

  const Lab = window.ElipseLab;

  // ───────────────────────────────────────────────────────────────────────────
  // Dial HUD (mismo look & feel que Kopp)
  // ───────────────────────────────────────────────────────────────────────────
  const DIAL_MARGIN = 16;
  const DIAL_R_CSS  = 40;
  const KNOB_R_CSS  = 5;
  const DIAL_GRAY   = 'rgba(156,163,175,0.35)'; // cara del dial (igual que Kopp/Conjugados)
  const AFF_CIRC_COLOR = '#9c9c9c';            // knob (igual que Kopp)

  // Halo y sombra (como en Kopp/Conjugados)
  const DIAL_SHADOW_COLOR = 'rgba(0,0,0,0.35)';
  const DIAL_SHADOW_BLUR  = 16;
  const DIAL_SHADOW_OFFY  = 2;
  const DIAL_HALO_OUTER   = 12;
  const DIAL_HALO_ALPHA   = 0.25;

  // Geometría del dial (esquina sup‑dcha, en px CSS)
  function dialGeom(canvas, offsetY = 0){
    const w = canvas.clientWidth;
    const cx = w - DIAL_MARGIN - DIAL_R_CSS;
    const cy = DIAL_MARGIN + DIAL_R_CSS + offsetY;
    return { cx, cy, R: DIAL_R_CSS, rKnob: KNOB_R_CSS };
  }

  // Utilidades de ángulos (convención Y↑ en mundo → en pantalla invertimos seno)
  const TAU = Math.PI * 2;

  function angleFromEvent(ev, g){
    const rect = ev.target.getBoundingClientRect();
    const mx   = ev.clientX - rect.left;
    const my   = ev.clientY - rect.top;
    // CSS Y↓ → mundo Y↑: negamos dy
    return Math.atan2(-(my - g.cy), (mx - g.cx));
  }

  function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }

  // Dibuja el dial con halo, sombra, arco de rango admisible y etiqueta Φ
  function drawPhiDialHUD(ctx, vp, a, b, phi, phiMin, phiMax){
    const dpr = vp.dpr || 1;

    // Si hay colisión potencial con el dial de Kopp, bajamos este dial una fila
    const active = Array.isArray(Lab.state.activeLayers) ? Lab.state.activeLayers : [];
    const offsetY = active.includes('kopp') ? (DIAL_R_CSS * 2 + 12) : 0;

    const g = dialGeom(ctx.canvas, offsetY);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // HALO
    {
      const R0  = g.R;
      const R1  = g.R + DIAL_HALO_OUTER;
      const grd = ctx.createRadialGradient(g.cx, g.cy, R0*0.98, g.cx, g.cy, R1);
      grd.addColorStop(0.00, 'rgba(0,0,0,0.00)');
      grd.addColorStop(0.35, 'rgba(0,0,0,0.06)');
      grd.addColorStop(0.70, `rgba(0,0,0,${DIAL_HALO_ALPHA*0.6})`);
      grd.addColorStop(1.00, `rgba(0,0,0,${DIAL_HALO_ALPHA})`);
      ctx.beginPath(); ctx.arc(g.cx, g.cy, R1, 0, TAU); ctx.fillStyle = grd; ctx.fill();
    }

    // SOMBRA
    {
      ctx.save();
      ctx.shadowColor   = DIAL_SHADOW_COLOR;
      ctx.shadowBlur    = DIAL_SHADOW_BLUR * dpr;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = DIAL_SHADOW_OFFY * dpr;
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, g.R + 1, 0, TAU);
      ctx.fillStyle = 'rgba(0,0,0,0.001)';
      ctx.fill();
      ctx.restore();
    }

    // CARA
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.R, 0, TAU);
    ctx.fillStyle = DIAL_GRAY;
    ctx.fill();

    // ARCO DEL RANGO ADMISIBLE [phiMin, phiMax] (verde)
    // Dibujo robusto muestreando ángulo matemático → coordenadas de pantalla (Y↓)
    {
      const steps = 60;
      const Rrng  = g.R + 1.5;
      ctx.save();
      ctx.strokeStyle = 'rgba(16,185,129,0.80)'; // verde tipo tailwind emerald-500 con alpha
      ctx.lineWidth   = 3.0 * dpr;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      for (let i = 0; i <= steps; i++){
        const u = phiMin + (phiMax - phiMin) * (i/steps);
        const x = g.cx + Math.cos(u) * Rrng;
        const y = g.cy - Math.sin(u) * Rrng; // invertir seno
        if (i === 0) ctx.moveTo(x, y);
        else         ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // Radios en los extremos del rango
      ctx.save();
      ctx.strokeStyle = 'rgba(16,185,129,0.85)';
      ctx.lineWidth   = 2.0 * dpr;
      ctx.beginPath();
      ctx.moveTo(g.cx, g.cy);
      ctx.lineTo(g.cx + Math.cos(phiMin)*g.R, g.cy - Math.sin(phiMin)*g.R);
      ctx.moveTo(g.cx, g.cy);
      ctx.lineTo(g.cx + Math.cos(phiMax)*g.R, g.cy - Math.sin(phiMax)*g.R);
      ctx.stroke();
      ctx.restore();
    }

    // KNOB (ángulo actual φ)
    const kx = g.cx + Math.cos(phi) * g.R;
    const ky = g.cy - Math.sin(phi) * g.R;
    ctx.fillStyle = AFF_CIRC_COLOR;
    ctx.beginPath(); ctx.arc(kx, ky, g.rKnob, 0, TAU); ctx.fill();

    // ETIQUETA Φ y rango (debajo del dial)
    {
      const deg = (rad)=> Math.round(rad * 180 / Math.PI);
      const txt = `Φ = ${deg(phi)}°   [${deg(phiMin)}° – ${deg(phiMax)}°]`;
      ctx.fillStyle = '#334155'; // slate-700
      ctx.font = `${12 * dpr}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(txt, g.cx, g.cy + g.R + 8 * dpr);
    }

    ctx.restore();
  }

  // Listeners del dial (registrados una vez por canvas)
  function ensurePhiDialListeners(canvas){
    if (Lab.state._phiHudBound) return;
    Lab.state._phiHudBound = true;

    const onDown = (ev) => {
      const active = Array.isArray(Lab.state.activeLayers) ? Lab.state.activeLayers : [];
      if (!active.includes('guiado_oblicuo_proclo')) return;

      // Offset Y si Kopp está activo (para calcular el dial correcto)
      const offsetY = active.includes('kopp') ? (DIAL_R_CSS * 2 + 12) : 0;
      const g = dialGeom(canvas, offsetY);
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const hit = Math.hypot(mx - g.cx, my - g.cy) <= (g.R + KNOB_R_CSS + 6);
      if (!hit) return;

      ev.preventDefault(); ev.stopPropagation();
      Lab.state._phiDrag = true;
      canvas.setPointerCapture?.(ev.pointerId);

      // En pointerdown ya fijamos φ al ángulo clamped dentro del rango
      updatePhiFromEvent(ev, canvas);
      Lab._redraw?.();
    };

    const onMove = (ev) => {
      if (!Lab.state._phiDrag) return;
      ev.preventDefault(); ev.stopPropagation();
      updatePhiFromEvent(ev, canvas);
      Lab._redraw?.();
    };

    const onUp = (ev) => {
      if (!Lab.state._phiDrag) return;
      Lab.state._phiDrag = false;
      canvas.releasePointerCapture?.(ev.pointerId);
      Lab._redraw?.();
    };

    canvas.addEventListener('pointerdown',  onDown, { capture:true });
    canvas.addEventListener('pointermove',  onMove, { capture:true });
    canvas.addEventListener('pointerup',    onUp,   { capture:true });
    canvas.addEventListener('pointercancel',onUp,   { capture:true });
  }

  // Actualiza state.phi desde puntero, CLAMP al rango admisible del frame (depende de a,b)
  function updatePhiFromEvent(ev, canvas){
    // Necesitamos a,b actuales para calcular φ_min
    const a = +Lab.state.a, b = +Lab.state.b;
    const eps = 1e-9;
    const sinPhiMin = Math.min(1.0, 2.0 * Math.sqrt(Math.max(a* b, 0)) / Math.max(a + b, eps));
    const phiMin    = Math.asin(sinPhiMin);
    const phiMax    = Math.PI - phiMin;

    // Offset Y si Kopp está activo
    const active = Array.isArray(Lab.state.activeLayers) ? Lab.state.activeLayers : [];
    const offsetY = active.includes('kopp') ? (DIAL_R_CSS * 2 + 12) : 0;
    const g = dialGeom(canvas, offsetY);

    let ang = angleFromEvent(ev, g); // matemático, [−π,π], eje X positivo → CCW
    if (ang < 0) ang += TAU;         // normaliza a [0, 2π)
    // Como φ solo tiene sentido en (0, π), traemos a [0, π]
    if (ang > Math.PI) ang = TAU - ang;

    // Clamp al rango admisible
    const phiClamped = clamp(ang, phiMin, phiMax);
    Lab.state.phi = phiClamped;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // REGISTRO DEL MODO
  // ───────────────────────────────────────────────────────────────────────────
  Lab.registerMode('guiado_oblicuo_proclo', function (ctx, state, H) {

    var vp  = H.viewport;
    var col = H.getColors();
    var pr  = H.params();
    var a   = pr.a;
    var b   = pr.b;
    var t   = state.t || 0;
    var drawFoci = H.drawFoci;

    var vCol   = '#000000';
    var vAlpha = (col.barAlpha != null) ? col.barAlpha : 0.90;
    var vWidth = col.barWidth  || (2.5 * (vp.dpr || 1));
    var jSize  = col.jointSize || (3.5 * (vp.dpr || 1));

    // Cronología
    var fVaraFade = H.clamp01((t - 0.15) * 20);
    var fGiro     = H.clamp01((t - 0.25) / 0.75);

    // φ_min y rango admisible
    var sinPhiMin = Math.min(1.0, 2.0 * Math.sqrt(a * b) / (a + b));
    var phiMin    = Math.asin(sinPhiMin);
    var phiMax    = Math.PI - phiMin;

    // Asegurar listeners del dial
    ensurePhiDialListeners(ctx.canvas);

    // Inicializar φ si no existe o está fuera del rango (centro del rango)
    if (state.phi == null || !(state.phi >= phiMin && state.phi <= phiMax)) {
      state.phi = (phiMin + phiMax) * 0.5;
    }
    var phi  = state.phi;
    var cphi = Math.cos(phi);
    var sphi = Math.sin(phi);

    // Color de guías
    var guiaCol = col.faint || '#888888';
    var lwGuia = 1.2 * (vp.dpr || 1);

    

    // Si φ < φ_min no hay solución (con el dial ya no debería ocurrir, por clamp),
    // pero dejamos una guarda:
    if (phi < phiMin - 1e-6){
      // Guía indicadora tenue
      var Lind = (a + b) * 1.1;
      ctx.save();
      ctx.strokeStyle = guiaCol;
      ctx.lineWidth   = (vp.dpr || 1);
      ctx.globalAlpha = 0.20;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(vp.X(-Lind * cphi), vp.Y(-Lind * sphi));
      ctx.lineTo(vp.X( Lind * cphi), vp.Y( Lind * sphi));
      ctx.stroke();
      ctx.restore();

      // Dial encima de todo
      drawPhiDialHUD(ctx, vp, a, b, phi, phiMin, phiMax);
      return;
    }

    // p y q (solución exacta)
    var pq_sum  = (a + b) * sphi;
    var pq_disc = pq_sum * pq_sum - 4 * a * b;
    if (pq_disc < 0) {
      drawPhiDialHUD(ctx, vp, a, b, phi, phiMin, phiMax);
      return;
    }
    var sq    = Math.sqrt(pq_disc);
    var p_obl = (pq_sum + sq) / 2;
    var q_obl = (pq_sum - sq) / 2;
    var C_obl = (p_obl + q_obl) * cphi / sphi;

    // Forma cuadrática
    var Am    = q_obl * q_obl;
    var Bfull = -2.0 * q_obl * (p_obl + q_obl) * cphi / sphi;
    var Cm    = (p_obl*p_obl + (2*p_obl*q_obl + q_obl*q_obl)*cphi*cphi) / (sphi*sphi);

    // Eigen y alpha
    var tr    = Am + Cm;
    var det   = Am * Cm - (Bfull * 0.5) * (Bfull * 0.5);
    var disc2 = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    var lam1  = tr / 2 - disc2;
    var alpha = (Math.abs(Bfull) < 1e-9 && Math.abs(lam1 - Am) < 1e-9)
      ? 0
      : Math.atan2(lam1 - Am, Bfull * 0.5);

    // θ0 (arranque en (a,0) en coordenadas rotadas)
    var sin_th0 = a * Math.sin(alpha) / q_obl;
    var cos_th0 = (C_obl * sin_th0 - a * Math.cos(alpha)) / p_obl;
    var theta0  = Math.atan2(sin_th0, cos_th0);

    // Rotación −alpha
    var ca = Math.cos(-alpha), sa = Math.sin(-alpha);

    // Dirección de guías (rotadas)
    var cosG1 = Math.cos(-alpha),       sinG1 = Math.sin(-alpha);
    var cosG2 = Math.cos(-alpha + phi), sinG2 = Math.sin(-alpha + phi);

    // Longitud de guías
    var Bmax  = Math.sqrt(C_obl*C_obl + (p_obl+q_obl)*(p_obl+q_obl));
    var Lguia = Math.max(Bmax * 1.12, a * 1.2);

    // Arco φ + rótulo (gris tenue, como Proclo)
    {
      var rArc  = Math.min(a, b) * 0.28;
      var angG1 = -alpha;
      var angG2 = -alpha + phi;
      H.drawArcWorld(ctx, 0, 0, rArc, angG1, angG2, { color: guiaCol, width: lwGuia, alpha: 0.6 }, vp);

      var angMid = angG1 + phi / 2;
      var rLabel = rArc * 1.55;
      H.drawLabel(ctx, vp.X(rLabel * Math.cos(angMid)), vp.Y(rLabel * Math.sin(angMid)),
        'φ', { size: 13, bold: true, color: guiaCol, alpha: 0.85 }, vp);
    }

    // Guía 1
    ctx.save();
    ctx.strokeStyle = guiaCol;
    ctx.lineWidth   = lwGuia;
    ctx.globalAlpha = 1.0;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(vp.X(-Lguia * cosG1), vp.Y(-Lguia * sinG1));
    ctx.lineTo(vp.X( Lguia * cosG1), vp.Y( Lguia * sinG1));
    ctx.stroke();
    ctx.restore();

    // Guía 2
    ctx.save();
    ctx.strokeStyle = guiaCol;
    ctx.lineWidth   = lwGuia;    // Usamos el grosor unificado
    ctx.globalAlpha = 1.0;       // <--- Subido de 0.55 a 1.0
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(vp.X(-Lguia * cosG2), vp.Y(-Lguia * sinG2));
    ctx.lineTo(vp.X( Lguia * cosG2), vp.Y( Lguia * sinG2));
    ctx.stroke();
    ctx.restore();

    // Ejes canónicos
        H.drawAxesExact(ctx, a, b, vp);

        // --- BLOQUE DE FOCOS ---
        if (state.showFoci) {
          drawFoci(ctx, a, b, vp);
        }
    // -----------------------

    // Vara
    if (fVaraFade > 0) {
      var th   = theta0 - fGiro * 2 * Math.PI;
      var s_th = Math.sin(th), c_th = Math.cos(th);

      var Px_raw = C_obl * s_th - p_obl * c_th;
      var Py_raw = q_obl * s_th;
      var Bx_raw = C_obl * s_th - (p_obl + q_obl) * c_th;
      var Ax_raw = C_obl * s_th;
      var Ay_raw = (p_obl + q_obl) * s_th;

      var P_obl = { x: ca * Px_raw - sa * Py_raw, y: sa * Px_raw + ca * Py_raw };
      var B_obl = { x: ca * Bx_raw,               y: sa * Bx_raw               };
      var A_obl = { x: ca * Ax_raw - sa * Ay_raw, y: sa * Ax_raw + ca * Ay_raw };

      H.drawSegment(ctx, B_obl, A_obl, col.barColor, vWidth, vAlpha * fVaraFade, vp);
      H.drawPoint(ctx, B_obl.x, B_obl.y, col.barColor, jSize, false, fVaraFade, vp);
      H.drawPoint(ctx, A_obl.x, A_obl.y, col.barColor, jSize, false, fVaraFade, vp);

      // Elipse (coincide con canónica)
      if (fGiro > 0) {
        ctx.save();
        ctx.strokeStyle = col.ellipse;
        ctx.lineWidth   = col.strokeGrueso;
        ctx.lineJoin    = 'round';
        var PASOS = 180, steps = Math.round(PASOS * fGiro);
        ctx.beginPath();
        for (var i = 0; i <= steps; i++) {
          var th_i = theta0 - (i / PASOS) * 2 * Math.PI;
          var si   = Math.sin(th_i), ci = Math.cos(th_i);
          var qx_r = C_obl * si - p_obl * ci;
          var qy_r = q_obl * si;
          var qx   = ca * qx_r - sa * qy_r;
          var qy   = sa * qx_r + ca * qy_r;
          if (i === 0) ctx.moveTo(vp.X(qx), vp.Y(qy));
          else         ctx.lineTo(vp.X(qx), vp.Y(qy));
        }
        ctx.stroke();
        ctx.restore();

        H.drawPoint(ctx, P_obl.x, P_obl.y, col.ellipse, jSize * 1.5, true, 1, vp);
      }
    }

    // DIAL HUD de φ (encima de todo)
    drawPhiDialHUD(ctx, vp, a, b, phi, phiMin, phiMax);
  });
}());