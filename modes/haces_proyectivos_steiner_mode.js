/**
 * MODO: Haces Proyectivos Steiner
 * Optimizaciones: Limpieza de redundancias, integración con imán del Core.
 */
(function () {
  if (!window.ElipseLab) return;

  window.ElipseLab.registerMode("haces_proyectivos_steiner", (ctx, state, helpers) => {
    const { viewport: vp, getColors, params, drawSegment, drawPoint, drawHandle, clamp01, drawFoci } = helpers;
    const col = getColors();
    const { a, b } = params();
    const t = state.t || 0;
    const sX = state.skewX || 0;

    // Transformaciones afines
    const applySkew = (x, y) => ({ x: x + (y / b) * sX, y });
    const unskew = (x, y) => ({ x: x - (y / b) * sX, y });

    const fAnimMarco = clamp01((t - 0.05) * 5);
    const fTrazo = clamp01((t - 0.25) / 0.75);
    const uNow = fTrazo * Math.PI * 2;
    const hMax = 2 * b;

    // --- CÁLCULO DE ESPACIADO ---
    const sRaw = state.spacing !== undefined ? state.spacing : 0.80;
    const N = Math.max(4, Math.round(10 - ((sRaw - 0.05) / 2.45) * 6));
    const N2 = N * 2;

    // 1) GENERACIÓN DE MARCAS
    const marcas = [];
    for (let i = -N2; i <= N2; i++) {
      const yP = (i / N2) * hMax;
      marcas.push(applySkew(-a, yP), applySkew(a, yP));
    }
    for (let i = -N; i <= N; i++) {
      const xP = (i / N) * a;
      marcas.push(applySkew(xP, hMax), applySkew(xP, -hMax));
    }

    // 2) DIBUJO DEL MARCO
    if (fAnimMarco > 0) {
      ctx.save();
      ctx.strokeStyle = col.faint;
      ctx.lineWidth = col.strokeFino;
      const d = b * fAnimMarco;

      const drawBox = (yT, yB) => {
        const pts = [applySkew(-a, yT), applySkew(a, yT), applySkew(a, yB), applySkew(-a, yB)];
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(vp.X(p.x), vp.Y(p.y)) : ctx.lineTo(vp.X(p.x), vp.Y(p.y)));
        ctx.closePath(); ctx.stroke();
      };

      drawBox(b, -b);
      if (t > 0.05) { drawBox(b + d, d); drawBox(-d, -b - d); }
      if (fAnimMarco >= 1) {
        marcas.forEach(m => drawPoint(ctx, m.x, m.y, col.faint, 2, false, 0.6, vp));
      }
      ctx.restore();
    }

    // 3) ELIPSE Y PUNTOS BASE
    const P1 = applySkew(-a, 0);
    const P2 = applySkew(a, 0);

    if (fTrazo > 0) {
      ctx.save();
      ctx.strokeStyle = col.ellipse;
      ctx.lineWidth = col.strokeGrueso;
      ctx.beginPath();
      const steps = Math.floor(300 * fTrazo);
      for (let i = 0; i <= steps; i++) {
        const p = applySkew(a * Math.cos((i / 300) * 2 * Math.PI), b * Math.sin((i / 300) * 2 * Math.PI));
        i === 0 ? ctx.moveTo(vp.X(p.x), vp.Y(p.y)) : ctx.lineTo(vp.X(p.x), vp.Y(p.y));
      }
      ctx.stroke();
      ctx.restore();
    }

    // 4) RASTROS (TRAILS)
    if (state.showTrails && fTrazo > 0) {
      const alphaT = col.traceAlpha || 0.3;
      const drawTrails = (O) => {
        const Ous = unskew(O.x, O.y);
        marcas.forEach(M => {
          if (Math.hypot(M.x - O.x, M.y - O.y) < 1e-3) return;
          const Mus = unskew(M.x, M.y);
          const vx = Mus.x - Ous.x, vy = Mus.y - Ous.y;
          const A = (vx*vx)/(a*a) + (vy*vy)/(b*b), B = 2*((Ous.x*vx)/(a*a) + (Ous.y*vy)/(b*b)), C = (Ous.x*Ous.x)/(a*a) + (Ous.y*Ous.y)/(b*b) - 1;
          const disc = B*B - 4*A*C;
          if (disc < 0) return;
          let th = (-B + Math.sqrt(disc)) / (2*A);
          if (th <= 1e-6) th = (-B - Math.sqrt(disc)) / (2*A);
          if (th > 1e-6) {
            let u = Math.atan2((Ous.y + th * vy) / b, (Ous.x + th * vx) / a);
            if (u < 0) u += Math.PI * 2;
            if (u <= uNow + 1e-9) drawSegment(ctx, O, M, col.faint, col.strokeFino, alphaT, vp);
          }
        });
      };
      drawTrails(P1); drawTrails(P2);
    }

    // 5) RAYOS ACTUALES Y TIRADOR
    if (fTrazo > 0) {
      const pNow = applySkew(a * Math.cos(uNow), b * Math.sin(uNow));
      const snapDist = 15 / vp.scale;

      const getTarget = (O) => {
        const dx = pNow.x - O.x, dy = pNow.y - O.y;
        const limY = dy > 0 ? hMax : -hMax;
        const sc = Math.min(Math.abs((applySkew(dx > 0 ? a : -a, 0).x - O.x) / dx), Math.abs((limY - O.y) / dy));
        const rawT = { x: O.x + dx * sc, y: O.y + dy * sc };
        let best = rawT, minD = Infinity;
        marcas.forEach(m => { const d = Math.hypot(m.x-rawT.x, m.y-rawT.y); if(d < minD){ minD = d; best = m; }});
        return minD < snapDist ? best : rawT;
      };

      const t1 = getTarget(P1), t2 = getTarget(P2);
      drawSegment(ctx, P1, t1, col.faint, col.strokeFino, 1, vp);
      drawSegment(ctx, P2, t2, col.faint, col.strokeFino, 1, vp);
      drawPoint(ctx, t1.x, t1.y, col.faint, 4, true, 1, vp);
      drawPoint(ctx, t2.x, t2.y, col.faint, 4, true, 1, vp);
      drawPoint(ctx, pNow.x, pNow.y, col.ellipse, col.jointSize/(vp.dpr||1), false, 1, vp);
    }

    // Tirador (Lógica de imán ya gestionada por el Core)
    const offW = 25 / (vp.scale * (state.userZoom || 1));
    drawHandle(ctx, a + sX + offW, b, "#10b981", 'h', 1, vp);
    drawPoint(ctx, P1.x, P1.y, "#4aa7ff", 5, true, 1, vp);
    drawPoint(ctx, P2.x, P2.y, col.foci, 5, true, 1, vp);

    if (state.showFoci) drawFoci(ctx, a, b, vp);
  });
})();