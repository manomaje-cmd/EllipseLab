(function() {
  if (!window.ElipseLab) return;

  ElipseLab.registerMode('astroide_hipocicloide', (ctx, state, helpers) => {
    const { 
      viewport: vp, getColors, params, 
      drawPoint, drawSegment, clamp01, drawAxesExact,
      drawHandle, drawFoci
    } = helpers;

    const { a, b } = params();
    const col = getColors();
    const t = state.t || 0;

    const R_fijo = a + b;
    const r_movil = R_fijo / 4;
    const distP = r_movil; 

    const fGiro = clamp01((t - 0.25) / 0.75);
    const theta = fGiro * Math.PI * 2; 

    const fOtherIn = clamp01((t - 0.04) / 0.06); 
    const fRodanteFade = clamp01((t - 0.08) * 12.5); 

    const centroM = { 
        x: (R_fijo - r_movil) * Math.cos(theta), 
        y: (R_fijo - r_movil) * Math.sin(theta) 
    };

    const anguloPunto = -3 * theta;
    const P = { 
        x: centroM.x + distP * Math.cos(anguloPunto), 
        y: centroM.y + distP * Math.sin(anguloPunto) 
    };

    // 1) Ejes y Tiradores
    {
      const fAxesIntro = 1 - clamp01(t / 0.25);
      if (fAxesIntro > 0) {
        const axAlpha = fAxesIntro * (col.alphaTenue || 1.0);
        drawSegment(ctx, { x: -R_fijo, y: 0 }, { x: R_fijo, y: 0 }, col.axis, col.strokeFino, axAlpha, vp);
        drawSegment(ctx, { x: 0, y: -R_fijo }, { x: 0, y: R_fijo }, col.axis, col.strokeFino, axAlpha, vp);
      } else if (state.showAxes) {
        drawAxesExact(ctx, a, b, vp);
      }
    }

    // Tirador rojo siempre visible, pase lo que pase
    drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp);

    // 2) Circunferencia Grande
    if (fOtherIn > 0) {
      const alphaBig = fOtherIn * (col.alphaTenue ?? 0.5);
      ctx.save();
      ctx.lineWidth = col.strokeFino;
      ctx.strokeStyle = col.circs;
      ctx.globalAlpha = alphaBig;
      ctx.beginPath();
      ctx.arc(vp.X(0), vp.Y(0), Math.abs(R_fijo) * vp.scale * vp.userZoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3) TRAZADO DE LA ASTROIDE (CORREGIDO A STROKE FINO)
    if (fGiro > 0) {
      ctx.save();
      ctx.strokeStyle = col.ellipse; 
      ctx.lineWidth = col.strokeFino; // <--- CAMBIO CLAVE: Ahora es fina como en tu archivo
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();

      const uMax = fGiro * Math.PI * 2;
      for (let u = 0; u <= uMax + 1e-9; u += 0.01) {
        const cx = (R_fijo - r_movil) * Math.cos(u);
        const cy = (R_fijo - r_movil) * Math.sin(u);
        const px = cx + r_movil * Math.cos(-3 * u);
        const py = cy + r_movil * Math.sin(-3 * u);
        
        if (u === 0) ctx.moveTo(vp.X(px), vp.Y(py)); 
        else ctx.lineTo(vp.X(px), vp.Y(py));
      }
      ctx.stroke();
      ctx.restore();
    }

    // 4) Circunferencia Rodante
    if (fRodanteFade > 0) {
      ctx.save();
      ctx.lineWidth = col.strokeFino;
      ctx.strokeStyle = col.circs;
      ctx.globalAlpha = fRodanteFade * (col.alphaMedio ?? 0.6);
      ctx.beginPath();
      ctx.arc(vp.X(centroM.x), vp.Y(centroM.y), Math.abs(r_movil) * vp.scale * vp.userZoom, 0, Math.PI * 2);
      ctx.stroke();
      
      drawSegment(ctx, centroM, P, col.circs, col.strokeFino, fRodanteFade, vp);
      drawPoint(ctx, centroM.x, centroM.y, col.circs, col.jointSize, false, fRodanteFade, vp);
      ctx.restore();
    }

    // 5) Punto trazador
    if (fGiro > 0) {
      const pSize = col.jointSize * 1.5;
      drawPoint(ctx, P.x, P.y, col.ellipse, pSize, true, fGiro, vp);
    }
    // --- BLOQUE DE FOCOS ---
    if (state.showFoci) {
      drawFoci(ctx, a, b, vp);
    }
    // -----------------------
  });
})();