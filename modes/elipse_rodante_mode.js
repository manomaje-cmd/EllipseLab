/**
 * Modo: elipse_rodante
 *
 * Una elipse rodante de semiejes (a_r, b_r) rueda sin deslizamiento
 * por el EXTERIOR de la elipse canónica (a, b).
 *
 * Parámetros configurables via sliders del panel:
 *   k    → tamaño relativo: a_r = k·a  (rango 0.1–2.0, defecto 0.5)
 *   εr   → excentricidad propia de la rodante (rango 0–0.964, defecto 0)
 *
 * Se trazan tres puntos de la elipse rodante:
 *   – vértice mayor  (a_r, 0)   → azul
 *   – foco           (c_r, 0)   → verde
 *   – vértice menor  (0, b_r)   → naranja
 */
(function () {
  if (!window.ElipseLab) return;

  ElipseLab.registerMode('elipse_rodante', (ctx, state, helpers) => {

    const {
      viewport: vp, getColors, params,
      drawPoint, drawAxesExact, drawHandle, drawSegment,
      clamp01, drawFoci
    } = helpers;

    const col   = getColors();
    const { a, b } = params();
    const t     = Number(state.t || 0);
    const jSize = col.jointSize || (3.5 * vp.dpr);
    const dpr   = vp.dpr || 1;

    // ── Leer parámetros de los sliders ──────────────────────────────────────
    function readSlider(id, def) {
      if (typeof document !== 'undefined') {
        const el = document.getElementById(id);
        if (el) {
          const v = Number(el.value);
          if (isFinite(v)) return v;
        }
      }
      return (state[id] != null) ? Number(state[id]) : def;
    }

    // Defaults: k=1, ε igual a la canónica (como el botón Reset)
    const epsCanonica = Math.sqrt(Math.max(0, 1 - (b * b) / (a * a)));
    const k   = Math.max(0.1, Math.min(2.0,  readSlider('erK',  1.0)));
    const eR  = Math.max(0.0, Math.min(0.964, readSlider('erEps', epsCanonica)));

    // Semiejes de la elipse rodante
    const a_r = k * a;
    const b_r = a_r * Math.sqrt(Math.max(0, 1 - eR * eR));
    const c_r = Math.sqrt(Math.max(0, a_r * a_r - b_r * b_r));

    // ── Cronología ───────────────────────────────────────────────────────────
    const fFade = clamp01((t - 0.05) * 8);
    const fGiro = clamp01((t - 0.25) / 0.75);

    // ── Ejes y tirador ───────────────────────────────────────────────────────
    const fEjes = t < 0.20 ? clamp01(1 - t / 0.20) : (state.showAxes ? 1 : 0);
    if (fEjes > 0) {
      ctx.save(); ctx.globalAlpha = fEjes;
      drawAxesExact(ctx, a, b, vp);
      ctx.restore();
    }
    drawHandle(ctx, a, 0, '#ff0000', 'h', 1, vp);

    // ── Tablas de arco ───────────────────────────────────────────────────────
    const N = 1800;

    function buildArcTable(sx, sy) {
      const table = new Float64Array(N + 1);
      let arc = 0;
      for (let i = 0; i < N; i++) {
        const t1 = i * 2 * Math.PI / N;
        const t2 = (i + 1) * 2 * Math.PI / N;
        const dx = sx * (Math.cos(t2) - Math.cos(t1));
        const dy = sy * (Math.sin(t2) - Math.sin(t1));
        arc += Math.sqrt(dx * dx + dy * dy);
        table[i + 1] = arc;
      }
      return table;
    }

    const arcOut  = buildArcTable(a, b);
    const arcRod  = buildArcTable(a_r, b_r);
    const totalOut = arcOut[N];
    const totalRod = arcRod[N];

    function paramToArc(tbl, angle) {
      angle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const idx = angle / (2 * Math.PI) * N;
      const i0  = Math.floor(idx) % N;
      const i1  = (i0 + 1) % N;
      const frac = idx - Math.floor(idx);
      const a1  = i1 === 0 ? tbl[N] : tbl[i1];
      return tbl[i0] + frac * (a1 - tbl[i0]);
    }

    function arcToParam(tbl, s, total) {
      s = ((s % total) + total) % total;
      let lo = 0, hi = N;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (tbl[mid] <= s) lo = mid; else hi = mid;
      }
      const t0 = lo * 2 * Math.PI / N;
      const t1 = hi * 2 * Math.PI / N;
      return t0 + (t1 - t0) * (s - tbl[lo]) / (tbl[hi] - tbl[lo] || 1e-15);
    }

    // ── Estado de la rodante para un ángulo t_out en la canónica ────────────
    function rollingState(t_out) {
      // Punto de contacto en la canónica
      const Pc = { x: a * Math.cos(t_out), y: b * Math.sin(t_out) };

      // Arco recorrido en la canónica desde 0 hasta t_out
      const arc_out = paramToArc(arcOut, t_out);

      // En rodadura exterior, la rodante avanza en sentido INVERSO:
      // igualamos el arco pero recorremos la rodante al revés
      const s_in = arcToParam(arcRod, totalRod - (arc_out % totalRod), totalRod);

      // Tangente a la canónica en Pc
      const tx_out = -a * Math.sin(t_out);
      const ty_out =  b * Math.cos(t_out);
      const ang_out = Math.atan2(ty_out, tx_out);

      // Tangente a la rodante en s_in (en sentido inverso, negamos)
      const tx_in =  a_r * Math.sin(s_in);
      const ty_in = -b_r * Math.cos(s_in);
      const ang_in0 = Math.atan2(ty_in, tx_in);

      // Ángulo de rotación: las tangentes deben coincidir
      const theta = ang_out - ang_in0;

      // Punto de contacto local en la rodante
      const Qil = { x: a_r * Math.cos(s_in), y: b_r * Math.sin(s_in) };

      // Centro de la rodante en mundo
      const cosT = Math.cos(theta), sinT = Math.sin(theta);
      const Cc = {
        x: Pc.x - (Qil.x * cosT - Qil.y * sinT),
        y: Pc.y - (Qil.x * sinT + Qil.y * cosT)
      };

      function worldPt(lx, ly) {
        return {
          x: Cc.x + lx * cosT - ly * sinT,
          y: Cc.y + lx * sinT + ly * cosT
        };
      }

      return { Pc, Cc, theta, worldPt };
    }

    // ── Elipse canónica (estática) ───────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = col.ellipse;
    ctx.lineWidth   = col.strokeGrueso || (2 * dpr);
    ctx.globalAlpha = fFade;
    ctx.beginPath();
    for (let i = 0; i <= 360; i++) {
      const ang = i * 2 * Math.PI / 360;
      const x = a * Math.cos(ang), y = b * Math.sin(ang);
      i === 0 ? ctx.moveTo(vp.X(x), vp.Y(y)) : ctx.lineTo(vp.X(x), vp.Y(y));
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    if (fGiro <= 0) return;

    // ── Trazas de los puntos ────────────────────────────────────────────
    const STEPS = 360;
    const steps_drawn = Math.round(STEPS * fGiro);

    const tracePts = [
      { local: [a_r, 0],  color: col.blue || '#2563eb', label: 'vértice a', esCardioide: true },
      { local: [c_r, 0],  color: col.foci  || '#10b981', label: 'foco 1'      },
      { local: [-c_r, 0], color: col.foci  || '#10b981', label: 'foco 2'    },
      { local: [0,  b_r], color: col.orange || '#f59e0b', label: 'vértice b' },
      { local: [0, 0],    color: col.label  || '#515152', label: 'centro'    },
    ];

    for (const trace of tracePts) {
      ctx.save();
      ctx.strokeStyle = trace.color;
      ctx.lineWidth   = 1.5 * dpr;
      
      if (trace.esCardioide) {
        ctx.lineWidth = 2 * dpr; // La cardioide (azul) se ve más potente
      } else {
        ctx.lineWidth = 1.0 * dpr; // El resto quedan finos
      }

      ctx.globalAlpha = 0.75;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      for (let i = 0; i <= steps_drawn; i++) {
        const t_out = i * 2 * Math.PI / STEPS;
        const { worldPt } = rollingState(t_out);
        const pt = worldPt(trace.local[0], trace.local[1]);
        i === 0 ? ctx.moveTo(vp.X(pt.x), vp.Y(pt.y))
                : ctx.lineTo(vp.X(pt.x), vp.Y(pt.y));
      }
      ctx.stroke();
      ctx.restore();
    }

    // ── Elipse rodante en posición actual ────────────────────────────────────
    const t_now = fGiro * 2 * Math.PI;
    const { Pc, Cc, worldPt } = rollingState(t_now);

    ctx.save();
    ctx.strokeStyle = col.circs || '#888';
    ctx.lineWidth   = 1.5 * dpr;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    const SEG = 120;
    for (let i = 0; i <= SEG; i++) {
      const ang = i * 2 * Math.PI / SEG;
      const pt  = worldPt(a_r * Math.cos(ang), b_r * Math.sin(ang));
      i === 0 ? ctx.moveTo(vp.X(pt.x), vp.Y(pt.y))
              : ctx.lineTo(vp.X(pt.x), vp.Y(pt.y));
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Diámetros mayor y menor de la rodante
    ctx.save();
    ctx.strokeStyle = col.circs || '#888';
    ctx.lineWidth   = 0.8 * dpr;
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    const vA1 = worldPt( a_r, 0), vA2 = worldPt(-a_r, 0);
    const vB1 = worldPt(0,  b_r), vB2 = worldPt(0, -b_r);
    ctx.beginPath();
    ctx.moveTo(vp.X(vA1.x), vp.Y(vA1.y));
    ctx.lineTo(vp.X(vA2.x), vp.Y(vA2.y));
    ctx.moveTo(vp.X(vB1.x), vp.Y(vB1.y));
    ctx.lineTo(vp.X(vB2.x), vp.Y(vB2.y));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    
    // --- RELLENO DE LAS CIRCUNFERENCIAS FOCALES (VERSIÓN AUTÓNOMA) ---
    if (fGiro > 0) {
        const { a, b } = params(); 
        const c = Math.sqrt(Math.max(0, a * a - b * b));
        const R_focal = 2 * a;
        const pasos = 120; 

        // Definimos t_now aquí mismo para evitar el error de "not defined"
        const t_now_relleno = fGiro * 2 * Math.PI;
        
        // Posición del punto de contacto Pc
        const pcX = a * Math.cos(t_now_relleno);
        const pcY = b * Math.sin(t_now_relleno);

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        const dpr = vp.dpr || 1;
        ctx.fillStyle = col.foci;
        ctx.globalAlpha = 0.05;

        const centrosX = [-c, c];

        centrosX.forEach(cx => {
            ctx.beginPath();
            const startX = vp.toCSSX(cx) * dpr;
            const startY = vp.toCSSY(0) * dpr;
            ctx.moveTo(startX, startY); 

            // Cálculo del ángulo focal con normalización anti-salto
            let angFocalFinal = Math.atan2(pcY, pcX - cx);
            if (angFocalFinal < 0) angFocalFinal += 2 * Math.PI;

            for (let i = 0; i <= pasos; i++) {
                const th = (angFocalFinal * i) / pasos;
                const xW = cx + R_focal * Math.cos(th);
                const yW = R_focal * Math.sin(th);
                
                const px = vp.toCSSX(xW) * dpr;
                const py = vp.toCSSY(yW) * dpr;
                ctx.lineTo(px, py);
            }

            ctx.lineTo(startX, startY);
            ctx.closePath();
            ctx.fill();
        });
        ctx.restore();
    }

    // Punto de contacto
    drawPoint(ctx, Pc.x, Pc.y, '#ef4444', jSize * 1.2, true, 1, vp);

    // ── FOCOS (Respuesta al botón Foci) ──────────────────────────────────────
    if (state.showFoci) {
      // 1. Focos de la elipse CANÓNICA (estática)
      drawFoci(ctx, a, b, vp);

      // 2. Focos de la elipse RODANTE (en su posición actual)
      // Calculamos la distancia focal de la rodante (ya calculada arriba como c_r)
      const f1_local = { x:  c_r, y: 0 };
      const f2_local = { x: -c_r, y: 0 };
      
      // Los transformamos a coordenadas de mundo usando la posición actual
      const f1_world = worldPt(f1_local.x, f1_local.y);
      const f2_world = worldPt(f2_local.x, f2_local.y);

      // Dibujamos los focos móviles
      // Usamos un color ligeramente distinto o el mismo verde de la traza para coherencia
      const focoColor = col.green || '#10b981';
      drawPoint(ctx, f1_world.x, f1_world.y, focoColor, jSize * 1.0, false, 1, vp);
      drawPoint(ctx, f2_world.x, f2_world.y, focoColor, jSize * 1.0, false, 1, vp);
    }

    // Tres puntos trazadores en posición actual
    for (const trace of tracePts) {
      const pt = worldPt(trace.local[0], trace.local[1]);
      drawPoint(ctx, pt.x, pt.y, trace.color, jSize * 1.4, true, 1, vp);
    }
  });
  })();