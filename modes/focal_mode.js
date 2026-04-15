(function() {
  if (!window.ElipseLab) return;

  ElipseLab.registerMode('focal', (ctx, state, helpers) => {
    const { 
      viewport, getColors, params, 
      drawPoint, drawFoci, drawAxesExact, drawHandle, // <-- Añadido drawHandle
      clamp01 
    } = helpers;

    const { a, b, c } = params();
    const vp   = viewport;
    const col  = getColors();
    const t    = state.t || 0; 
    const L    = 2 * a;
    const density = state.spacing || 0.8;

    // --- CRONOGRAMA SINCRONIZADO ---
    const fFociFade         = clamp01(t * 20);
    const fDirectorasFade   = clamp01((t - 0.05) * 20);
    const fPuntoFade        = clamp01((t - 0.10) * 10);
    const fCircActFade      = clamp01((t - 0.20) * 20);
    const fGiro             = clamp01((t - 0.25) / 0.75);

    const haloPx = Math.max(4, (state.focusHaloPx || col.focusHaloPx || 5) * (vp.dpr || 1));

    function clearRightFocusHalo(pxRadius) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(vp.X(+c), vp.Y(0), pxRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();

    // 0) Ejes a demanda + Tirador manual si los ejes están apagados
    if (state.showAxes) {
      drawAxesExact(ctx, a, b, vp);
    } else {
      // Dibuja el tirador rojo para modificar "a" cuando no hay ejes
      drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp);
    }

    // 1) CIRCUNFERENCIAS DIRECTORAS FIJAS
    if (fDirectorasFade > 0) {
      ctx.save();
      ctx.strokeStyle = col.foci;
      ctx.lineWidth   = col.strokeFino;
      ctx.globalAlpha = fDirectorasFade * col.alphaTenue;
      ctx.beginPath();
      ctx.arc(vp.X(-c), vp.Y(0), L * vp.scale * vp.userZoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2) RASTRO DE CIRCUNFERENCIAS ENVOLVENTES
    if (fGiro > 0 && state.showTrails) {
      ctx.save();
      ctx.strokeStyle = col.traceColor;
      ctx.lineWidth   = col.traceWidth;
      ctx.globalAlpha = col.traceAlpha;

      const pasosMax       = Math.floor(100 / (density + 0.1)); 
      const pasosActuales  = Math.floor(pasosMax * fGiro); 

      for (let i = 0; i <= pasosActuales; i++) {
        const ang = (i / pasosMax) * Math.PI * 2;
        const mx = a * Math.cos(ang);
        const my = b * Math.sin(ang);
        const r = L - Math.hypot(mx - (-c), my - 0);

        if (r > 0) {
          ctx.beginPath();
          ctx.arc(vp.X(mx), vp.Y(my), r * vp.scale * vp.userZoom, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
      clearRightFocusHalo(haloPx);
    }

    // 3) TRAZADO DE LA ELIPSE
    if (fGiro > 0) {
      ctx.save();
      ctx.strokeStyle = col.ellipse;
      ctx.lineWidth   = col.strokeGrueso;
      ctx.lineCap     = "round";
      ctx.lineJoin    = "round";
      ctx.beginPath();
      for (let i = 0; i <= fGiro + 0.005; i += 0.01) {
        const u  = i * Math.PI * 2;
        const px = a * Math.cos(u), py = b * Math.sin(u);
        if (i === 0) ctx.moveTo(vp.X(px), vp.Y(py));
        else         ctx.lineTo(vp.X(px), vp.Y(py));
      }
      ctx.stroke();
      ctx.restore();
    }

    // 4) CIRCUNFERENCIA INSTANTÁNEA
    if (fCircActFade > 0) {
      const angNow = fGiro * Math.PI * 2;
      const mxNow  = a * Math.cos(angNow);
      const myNow  = b * Math.sin(angNow);
      const rNow   = L - Math.hypot(mxNow - (-c), myNow - 0);

      if (rNow > 0) {
        ctx.save();
        ctx.strokeStyle = col.circs;
        ctx.globalAlpha = fCircActFade * col.alphaFuerte;
        ctx.lineWidth   = col.strokeMedio;
        ctx.beginPath();
        ctx.arc(vp.X(mxNow), vp.Y(myNow), rNow * vp.scale * vp.userZoom, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        clearRightFocusHalo(haloPx);
      }

      // 5) Punto de tangencia
      if (fPuntoFade > 0) {
        drawPoint(ctx, mxNow, myNow, col.ellipse, col.jointSize, fGiro > 0, fPuntoFade, vp);
      }
    }

    // 6) FOCOS
    if (fFociFade > 0) {
      ctx.save();
      ctx.globalAlpha = fFociFade;
      drawFoci(ctx, a, b, vp);
      ctx.restore();
    }

    ctx.restore();
  });
})();