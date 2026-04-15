/**
 * arquimedes_3_mode.js — ElipseLab Pro
 * Triamel de Arquímedes con tres lanzaderas (triángulo equilátero rígido)
 *
 * Reglas del modo:
 *  - Solo usa draw(ctx, state, helpers). No toques DOM ni añadas eventos.
 *  - Dibuja en "mundo" (Y hacia arriba). Los helpers convierten a pantalla.
 *  - Ejes solo si state.showAxes === true, con helpers.drawAxesExact(...).
 *
 * ── GEOMETRÍA ──────────────────────────────────────────────────────────────
 * Tres ranuras a α_k = k·120°. Una manivela de radio ρ = a+b gira con φ.
 * Los tres patines son la proyección del extremo de la manivela sobre cada
 * ranura:
 *   s_k(φ) = ρ·cos(φ − α_k)
 *   P_k    = s_k · û_k
 *
 * Los tres patines forman un triángulo equilátero rígido (lado = ρ√3).
 *
 * El trazador T es la combinación lineal de los tres patines:
 *   T = c0·P0 + c1·P1 + c2·P2
 * con pesos:
 *   c0 = (3a − b) / (3(a+b))
 *   c1 = c2 = 2b / (3(a+b))
 *
 * Se comprueba que T(φ) = (a·cos φ, b·sin φ).
 * ────────────────────────────────────────────────────────────────────────────
 */
(function () {
  if (!window.ElipseLab) return;

  const ALPHA = [0, 2 * Math.PI / 3, 4 * Math.PI / 3];
  const U = ALPHA.map(ak => ({ x: Math.cos(ak), y: Math.sin(ak) }));

  function kinematics(phi, a, b) {
    const rho = a + b;
    const P = ALPHA.map((ak, k) => {
      const sk = rho * Math.cos(phi - ak);
      return { x: sk * U[k].x, y: sk * U[k].y };
    });
    const c0 = (3 * a - b) / (3 * rho);
    const c1 = 2 * b / (3 * rho); // c2 = c1
    const T = {
      x: c0 * P[0].x + c1 * P[1].x + c1 * P[2].x,
      y: c0 * P[0].y + c1 * P[1].y + c1 * P[2].y
    };
    return { P, T, rho };
  }

  ElipseLab.registerMode('arquimedes_3', (ctx, state, helpers) => {
    const {
      viewport: vp, getColors, params,
      drawSegment, drawPoint, drawAxesExact, drawHandle, drawFoci,
      clamp01
    } = helpers;

    const { a, b } = params();
    const col = getColors();
    const t = state.t || 0;

    // ── Estilo mecánico ───────────────────────────────────────────────────
    const vCol   = col.barColor  || '#c2410c';
    const vAlpha = col.barAlpha  || 0.90;
    const vWidth = col.barWidth  || (2.5 * vp.dpr);
    const jSize  = col.jointSize || (3.5 * vp.dpr);

    // ── Cronología ────────────────────────────────────────────────────────
    const fRailsFade = clamp01(t * 20);            // 0.00→0.05
    const fVaraFade  = clamp01((t - 0.05) / 0.15); // 0.05→0.20
    const fGiro      = clamp01((t - 0.25) / 0.75); // 0.25→1.00  ← inicio a 0.25·t
    const phi        = fGiro * Math.PI * 2;

    // ── Cinemática instantánea ────────────────────────────────────────────
    const { P, T, rho } = kinematics(phi, a, b);

    // ── 0) Diámetros: fade durante la animación; después, controlados por showAxes ──
    const fAxesFade = 1 - clamp01(fGiro / 0.12);
    if (fAxesFade > 0) {
      // Durante la animación: siempre visibles con fade out
      const axAlpha = fAxesFade * (col.alphaTenue || 1.0);
      drawSegment(ctx, { x: -a, y: 0 }, { x: a, y: 0 }, col.axis, col.strokeFino, axAlpha, vp);
      drawSegment(ctx, { x: 0, y: -b }, { x: 0, y: b }, col.axis, col.strokeFino, axAlpha, vp);
    } else if (state.showAxes) {
      // Animación terminada: respeta el botón del usuario
      drawAxesExact(ctx, a, b, vp);
    }

    // ── 0.25) Focos: solo si el usuario los pide con el botón Mostrar focos ──
    if (state.showFoci) {
      // Sin fade: presencia a discreción del usuario
      drawFoci(ctx, a, b, vp);
    }

    // ── 0.5) Tiradores oficiales (core) SIEMPRE visibles en este modo ────
    drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp);

    // ── 0.7) Circunferencia auxiliar reactiva ────────────────────────────
    const isDraggingA = (state._dragTarget === 'a');

    // Fade out: de 1 a 0 cuando t va de 0.20 a 0.25
    const fFadeOut = 1 - clamp01((t - 0.20) / 0.05);

    // Opacidad: visible si estamos en el tiempo de inicio O si estamos arrastrando 'a'
    let auxAlpha = isDraggingA ? 1.0 : fFadeOut;
    auxAlpha *= (col.alphaTenue || 0.15);

    if (auxAlpha > 0) {
      ctx.save();
      ctx.strokeStyle = col.faint;
      ctx.lineWidth = col.strokeFino;
      ctx.globalAlpha = auxAlpha;

      // Movimiento ultra rápido: de 0 a 'a' en t=0.04
      // Si ya pasó la animación (t > 0.04), se queda fija en 'a'
      const fAnim = clamp01(t / 0.04);
      const posX = a * fAnim; 

      helpers.drawCircleWorld(
        ctx, 
        posX, 
        0, 
        b, 
        col.faint, 
        col.strokeFino, 
        auxAlpha, 
        vp
      );
      ctx.restore();
    }

    // ── 1) RANURAS ────────────────────────────────────────────────────────
    if (fRailsFade > 0) {
      const railLen   = rho;
      const railAlpha = fRailsFade * (col.alphaTenue || 0.15);

      ALPHA.forEach((ak, k) => {
        const ux = U[k].x, uy = U[k].y;
        // Ranura
        drawSegment(ctx,
          { x: -railLen * ux, y: -railLen * uy },
          { x:  railLen * ux, y:  railLen * uy },
          col.faint, col.strokeFino, railAlpha, vp
        );
      });
    }

    // ── 2) TRIÁNGULO y enlaces al trazador ────────────────────────────────
    if (fVaraFade > 0) {
      const al = fVaraFade * vAlpha;
      const { P: P0, T: T0 } = kinematics(0, a, b);
      const posP = fGiro === 0 ? P0 : P;
      const posT = fGiro === 0 ? T0 : T;

      // Lados del triángulo rígido
      for (let k = 0; k < 3; k++) {
        drawSegment(ctx, posP[k], posP[(k + 1) % 3], vCol, vWidth, al, vp);
      }

      // Vectores de combinación lineal hacia el trazador
      for (let k = 0; k < 3; k++) {
        drawSegment(ctx, posT, posP[k], vCol, vWidth, al, vp);
      }

      // Patines
      posP.forEach(pt => {
        drawPoint(ctx, pt.x, pt.y, vCol, jSize * 1.3, true, al, vp);
      });

      // Trazador (pelotita)
      drawPoint(ctx, posT.x, posT.y, col.ellipse, jSize * 1.6, true, al, vp);
    }

    // ── 3) ELIPSE (trazo perfectamente sincronizado con la pelotita) ─────
    if (fGiro > 0) {
      ctx.save();
      ctx.strokeStyle = col.ellipse;
      ctx.lineWidth   = col.strokeGrueso;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.beginPath();

      const stepsFixed = 720;                    // resolución base
      const nSeg       = Math.max(1, Math.round(stepsFixed * fGiro));
      const phiEnd     = fGiro * Math.PI * 2;

      if (nSeg === 1) {
        // Un único segmento: forzar final explícito en T(φEnd)
        const { T: Tstart } = kinematics(0, a, b);
        ctx.moveTo(vp.X(Tstart.x), vp.Y(Tstart.y));
        ctx.lineTo(vp.X(T.x),      vp.Y(T.y));
      } else {
        for (let i = 0; i <= nSeg; i++) {
          const ph = (i / nSeg) * phiEnd;       // último i → φEnd exacto
          const { T: Ti } = kinematics(ph, a, b);
          if (i === 0) ctx.moveTo(vp.X(Ti.x), vp.Y(Ti.y));
          else         ctx.lineTo(vp.X(Ti.x), vp.Y(Ti.y));
        }
      }

      ctx.stroke();
      ctx.restore();

      // Pelotita al final del trazo (coincidente con el extremo)
      drawPoint(ctx, T.x, T.y, col.ellipse, jSize * 1.6, true, 1, vp);
    }
  });
})();