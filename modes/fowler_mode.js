/**
 * Reglas del modo:
 * - Solo usa draw(ctx, state, H). No toques DOM ni añadas eventos.
 * - Dibuja en "mundo" (Y hacia arriba). Los helpers convierten a pantalla.
 *
 * FOWLER ELLIPSOGRAPH — versión con nueva coreografía 0–0.25t
 * ------------------------------------------------------------
 * Dos circunferencias iguales de radio b engranadas externamente.
 *
 * TRAZADORA: centro oscila horizontalmente ±(a-b).
 *   T = ((a-b)·cos φ, 0)
 *   P = T + b·(cos φ, sin φ) = (a·cos φ, b·sin φ)  → elipse exacta
 *
 * CONDUCTORA (derecha): C = T + (2b, 0)
 *   Punto guía M: x = +2b (fijo, guía vertical), y = −(a-b)·sin φ
 *   Círculo concéntrico de radio (a-b): locus de M dentro de la conductora
 *
 * CRONOLOGÍA (actualizada):
 *   0.00–0.04  Fade in: SOLO circunferencia de radio b centrada en el origen
 *   0.04–0.07  Fade in: segunda circ. de radio b (x=+2b) + circ. pequeña (a-b) en (a,0)
 *   0.07–0.10  Traslado MUY rápido de la circ. pequeña hasta ser concéntrica con C (derecha)
 *   0.07–0.17  Desplazamiento suave del par hasta la posición φ=0 (Tc: 0 → a-b)
 *   0.17–0.22  Fade in guías horizontales (acortadas, tangentes a r=b para a_max)
 *   0.22–0.25  Fade in puntos M y P
 *   0.25–1.00  Giro completo + trazado de la elipse
 */
(function () {
  if (!window.ElipseLab) return;

  ElipseLab.registerMode('fowler', (ctx, state, helpers) => {
    const {
      viewport: vp, getColors, params,
      drawSegment, drawPoint, drawAxesExact,
      drawHandle, clamp01, drawCircleWorld, drawFoci
    } = helpers;

    const { a, b } = params();
    const col = getColors();
    const t = state.t || 0;

    // --- ESTÁNDARES MECÁNICOS (alineados con doble_manivela) ---
    const vAlpha       = col.barAlpha   || 0.90;
    const vWidth       = col.barWidth   || (2.5 * (vp.dpr || 1));
    const jSize        = col.jointSize  || (3.5 * (vp.dpr || 1));

    // Soportes/guías “tenues” (contexto)
    const grisSoporte  = col.faint      || "#888888";
    const alphaSoporte = col.alphaTenue || 0.3;
    const lw           = 1 * (vp.dpr || 1);

    // Límite vertical de barras/diámetros (heredado)
    const LIMY = 277;

    // --- CRONOLOGÍA / FACTORES ---
    // Nueva apertura
    const fSoloB1    = clamp01(t / 0.04);          // 0.00–0.04: solo circ. b centrada
    const fOtros     = clamp01((t - 0.04) / 0.03); // 0.04–0.07: 2ª circ. b + circ. pequeña
    const fSmallMove = clamp01((t - 0.07) / 0.03); // 0.07–0.10: migración rápida circ. pequeña

    // Guía vertical (como antes)
    const fApareV    = clamp01(t / 0.07);

    // Desplazamiento del par hasta φ=0 (como antes)
    const fDespl     = clamp01((t - 0.07) / 0.10);

    // Resto sin cambios
    const fRect      = clamp01((t - 0.17) / 0.05);
    const fPuntos    = clamp01((t - 0.22) / 0.03);
    const fGiro      = clamp01((t - 0.25) / 0.75);

    // --- GEOMETRÍA / ESTADO INSTANTÁNEO ---
    const phi = fGiro * Math.PI * 2;

    // Centros activo-actuales del par de circunferencias de radio b
    // - Antes de girar: Tc avanza 0 → a-b (fDespl), Cc = Tc + (2b, 0)
    // - Durante el giro: Tc = (a-b)cosφ, Cc = Tc + (2b, 0)
    const TcAct = (fGiro > 0)
      ? { x: (a - b) * Math.cos(phi), y: 0 }
      : { x: fDespl * (a - b),        y: 0 };
    const CcAct = { x: TcAct.x + 2 * b, y: 0 };

    // Puntos guía
    const P = { x: TcAct.x + b * Math.cos(phi), y: b * Math.sin(phi) };
    const M = { x: 2 * b, y: +(a - b) * Math.sin(phi) };

    // --- GUÍAS HORIZONTALES (acortadas: tangentes a r=b con excentricidad máxima) ---
    // Mantengo a_max=377 de tu escena; b es el actual (para tangencia en y=±b).
    const aMax = 377;                 // excentricidad máxima permitida en UI
    const hX1  = -(aMax - b);         // cubre Tc.x mínimo
    const hX2  =  (aMax + b);         // cubre Cc.x máximo (= (aMax - b) + 2b)

    // --- DIBUJO ---

    // Ejes: fade out 0→0.25; después, obedecen al botón Mostrar diámetros
    const fEjes = t < 0.25 ? clamp01(1 - t / 0.25) : (state.showAxes ? 1 : 0);
    if (fEjes > 0) {
      ctx.save();
      ctx.globalAlpha = fEjes;
      drawAxesExact(ctx, a, b, vp);
      ctx.restore();
    }

    // Tirador rojo del diámetro mayor: siempre visible
    drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp);

    // Guía vertical (x = 2b) — estilo mecánico (barColor/barWidth/barAlpha)
    if (fApareV > 0 && fGiro === 0) {
      drawSegment(
        ctx,
        { x: 2 * b, y: -LIMY },
        { x: 2 * b, y:  LIMY },
        col.barColor,
        vWidth,
        vAlpha * fApareV,
        vp
      );
    }

    // --- APERTURA 0–0.25t ---
    if (t < 0.25) {
      // 1) 0–0.04: Solo circunf. de radio b centrada en el origen (trazadora, en reposo inicial)
      if (fSoloB1 > 0) {
        ctx.save();
        ctx.globalAlpha = fSoloB1;
        drawCircleWorld(ctx, 0, 0, b, grisSoporte, lw, alphaSoporte, vp);
        drawPoint(ctx, 0, 0, grisSoporte, jSize * 0.8, false, alphaSoporte, vp);
        ctx.restore();
      }

      // 2) 0.04–0.07: Aparición de la conductora (x=+2b) y de la pequeña (a-b) en (a,0)
      if (fOtros > 0) {
        ctx.save();
        ctx.globalAlpha = fOtros;

        // conductora (radio b) en x=+2b
        drawCircleWorld(ctx, 2 * b, 0, b, grisSoporte, lw, alphaSoporte, vp);
        drawPoint(ctx, 2 * b, 0, grisSoporte, jSize * 0.8, false, alphaSoporte, vp);

        // pequeña (radio a-b) inicialmente en (a,0)
        const Csmall0 = { x: a, y: 0 };

        // 3) 0.07–0.10: migración muy rápida hasta ser concéntrica con CcAct (que ya se desplaza 0.07–0.17)
        const Csmall = {
          x: Csmall0.x + (CcAct.x - Csmall0.x) * fSmallMove,
          y: 0
        };

        drawCircleWorld(ctx, Csmall.x, Csmall.y, a - b, grisSoporte, lw, alphaSoporte * 0.8, vp);
        drawPoint(ctx, Csmall.x, Csmall.y, grisSoporte, jSize * 0.8, false, alphaSoporte * 0.8, vp);

        ctx.restore();
      }

      // Punto M inicial (presentación antes del giro)
      if ((fSoloB1 > 0 || fOtros > 0) && fGiro === 0) {
        drawPoint(ctx, 2 * b, 0, col.barColor, jSize, false, vAlpha * Math.max(fSoloB1, fOtros), vp);
      }
    }

    // Guías horizontales (lados del “rectángulo” acortados) — aparecen 0.17–0.22
    if (fRect > 0) {
      const alpha = fRect * alphaSoporte;
      drawSegment(ctx, { x: hX1, y: -b }, { x: hX2, y: -b }, grisSoporte, lw, alpha, vp);
      drawSegment(ctx, { x: hX1, y:  +b }, { x: hX2, y:  +b }, grisSoporte, lw, alpha, vp);
    }

    // Punto P inicial (vértice derecho de la elipse) — 0.22–0.25
    if (fPuntos > 0 && fGiro === 0) {
      drawPoint(ctx, a, 0, col.ellipse, jSize * 1.2, true, fPuntos, vp);
    }

    // --- FASE TRAZADO (t >= 0.25) ---
    if (fGiro > 0) {
      // Guía vertical por encima — estilo mecánico
      drawSegment(
        ctx,
        { x: 2 * b, y: -LIMY },
        { x: 2 * b, y:  LIMY },
        col.barColor,
        vWidth,
        vAlpha,
        vp
      );

      // Diámetro de la CONDUCTORA en dirección de M — estilo mecánico
      const _dMx = M.x - CcAct.x, _dMy = M.y - CcAct.y;
      const _dMlen = Math.hypot(_dMx, _dMy) || 1;
      const _ux = _dMx / _dMlen, _uy = _dMy / _dMlen;
      const _D1 = { x: CcAct.x + LIMY * _ux, y: CcAct.y + LIMY * _uy };
      const _D2 = { x: CcAct.x - LIMY * _ux, y: CcAct.y - LIMY * _uy };
      drawSegment(ctx, _D1, _D2, col.barColor, vWidth, vAlpha, vp);

      // Circunferencias animadas (contexto) + centros
      drawCircleWorld(ctx, TcAct.x, TcAct.y, b,     grisSoporte, lw, alphaSoporte,       vp);
      drawCircleWorld(ctx, CcAct.x, CcAct.y, b,     grisSoporte, lw, alphaSoporte,       vp);
      drawCircleWorld(ctx, CcAct.x, CcAct.y, a - b, grisSoporte, lw, alphaSoporte * 0.8, vp);

      drawPoint(ctx, TcAct.x, TcAct.y, grisSoporte, jSize * 0.8, false, alphaSoporte,       vp);
      drawPoint(ctx, CcAct.x, CcAct.y, grisSoporte, jSize * 0.8, false, alphaSoporte,       vp);
      // Nota: el centro de la pequeña coincide con CcAct; no duplicamos marca adicional.

      // Punto M
      drawPoint(ctx, M.x, M.y, col.barColor, jSize, false, vAlpha, vp);

      // Elipse trazada — progreso con fGiro
      ctx.save();
      ctx.strokeStyle = col.ellipse;
      ctx.lineWidth   = col.strokeGrueso;
      ctx.lineJoin    = "round";
      const uMax = fGiro * 2 * Math.PI;
      ctx.beginPath();
      for (let u = 0; u <= uMax + 0.02; u += 0.02) {
        const ex = a * Math.cos(u);
        const ey = b * Math.sin(u);
        if (u === 0) ctx.moveTo(vp.X(ex), vp.Y(ey));
        else         ctx.lineTo(vp.X(ex), vp.Y(ey));
      }
      ctx.stroke();
      ctx.restore();

      // Diámetro de la TRAZADORA en dirección de P — estilo mecánico
      const _tPx = P.x - TcAct.x, _tPy = P.y - TcAct.y;
      const _tPlen = Math.hypot(_tPx, _tPy) || 1;
      const _tUx = _tPx / _tPlen, _tUy = _tPy / _tPlen;
      const _tE1 = { x: TcAct.x + b * _tUx, y: TcAct.y + b * _tUy };
      const _tE2 = { x: TcAct.x - b * _tUx, y: TcAct.y - b * _tUy };
      drawSegment(ctx, _tE1, _tE2, col.barColor, vWidth, vAlpha, vp);

      // Punto trazador P
      drawPoint(ctx, P.x, P.y, col.ellipse, jSize * 1.5, true, 1, vp);
    }
    // === FOCOS — solo si el usuario los pide (sin fade) ===
    if (state.showFoci) {
      drawFoci(ctx, a, b, vp);
    }
  });
})();