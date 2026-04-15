/**
 * Modo: Círculos (envolventes circulares) - Versión Procedural Optimizada
 */
(function () {
  if (!window.ElipseLab) return;

  window.ElipseLab.registerMode('circulos', (ctx, state, H) => {
    const { 
      viewport: vp, getColors, params, clamp01, 
      drawAxesExact, drawSegment, drawPoint, drawFoci, 
      drawHandle // <-- Helper añadido
    } = H;
    
    const { a, b, c } = params();
    const col = getColors();

    const t = clamp01(state.t || 0);

    // --- Coreografía de Tiempos ---
    const fCircB   = clamp01(t * 20);           // 0.00 - 0.05
    const fEstruct = clamp01((t - 0.05) * 20);  // 0.05 - 0.10
    const fDiag    = clamp01((t - 0.10) * 20);  // 0.10 - 0.15
    const fArcoC   = clamp01((t - 0.15) * 20);  // 0.15 - 0.20
    const fFadeOut = clamp01((t - 0.20) * 20);  // 0.20 - 0.25

    // === Diámetros/Ejes ===
    const fAxesFade = 1 - clamp01(t / 0.8);
    if (fAxesFade > 0) {
      const axAlpha = fAxesFade * (col.alphaTenue || 1.0);
      const lw      = col.strokeFino || (1.2 * (vp.dpr || 1));
      drawSegment(ctx, { x: -a, y: 0 }, { x:  a, y: 0 }, col.axis, lw, axAlpha, vp); // mayor
      drawSegment(ctx, { x:  0, y:-b }, { x:  0, y:  b }, col.axis, lw, axAlpha, vp); // menor
    } else if (state.showAxes === true || state.showDiameters === true) {
      drawAxesExact(ctx, a, b, vp);
    }

    // --- TIRADOR ROJO SIEMPRE VISIBLE SI "DIÁMETROS" ESTÁ APAGADO ---
    // Se dibuja fuera del fade-out para que esté disponible desde t=0
    if (!state.showAxes && !state.showDiameters) {
      drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp);
    }

    // === Fade-out rápido para elementos AZULES (diagonales + arcos focales) ===
    const fBlueOut = (t < 0.80) ? 1 : Math.max(0, 1 - (t - 0.80) / 0.05);

    // Variables de construcción
    const colPos = col.foci;  // azul de construcción "positiva"
    const colRad = "#000000"; // negro para radios/estructuras
    const yStop = (b * c) / Math.max(a, 1e-9);

    // === 1) Focos ===
    if (t > 0.05) drawFoci(ctx, a, b, vp);

    // === 2) Construcción Inicial ===
    ctx.save();
    ctx.strokeStyle = colRad;
    ctx.lineWidth   = col.strokeMedio;
    ctx.globalAlpha = 1.0 * fCircB;
    ctx.beginPath();
    ctx.arc(vp.X(0), vp.Y(0), b * vp.scale * vp.userZoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const xH = c * fEstruct;
    const yV = b * fEstruct;
    const alphaStruct = (1 - fFadeOut);

    // Guías de construcción (grises)
    drawSegment(ctx, {x: -xH, y:  b}, {x:  xH, y:  b}, col.faint, col.strokeFino, alphaStruct, vp);
    drawSegment(ctx, {x: -c,  y:  0}, {x: -c,  y:  yV}, col.faint, col.strokeFino, alphaStruct, vp);
    drawSegment(ctx, {x:  c,  y:  0}, {x:  c,  y:  yV}, col.faint, col.strokeFino, alphaStruct, vp);
    drawSegment(ctx, {x: -xH, y: -b}, {x:  xH, y: -b}, col.faint, col.strokeFino, alphaStruct, vp);
    drawSegment(ctx, {x: -c,  y:  0}, {x: -c,  y: -yV}, col.faint, col.strokeFino, alphaStruct, vp);
    drawSegment(ctx, {x:  c,  y:  0}, {x:  c,  y: -yV}, col.faint, col.strokeFino, alphaStruct, vp);

    // === 2.b) Diagonales AZULES ===
    if (fDiag > 0) {
      const xStop = (c * c) / Math.max(a, 1e-9);
      const alphaIn  = 0.4 * fDiag * fBlueOut;
      const alphaOut = alphaIn * (1 - fFadeOut);

      drawSegment(ctx, {x: -xStop, y:  yStop}, {x: 0, y: 0}, colPos, col.strokeMedio, alphaIn,  vp);
      drawSegment(ctx, {x: -c, y: b},         {x: -xStop, y: yStop}, colPos, col.strokeMedio, alphaOut, vp);
      drawSegment(ctx, {x:  xStop, y:  yStop}, {x: 0, y: 0}, colPos, col.strokeMedio, alphaIn,  vp);
      drawSegment(ctx, {x:  c, y: b},         {x:  xStop, y: yStop}, colPos, col.strokeMedio, alphaOut, vp);
      drawSegment(ctx, {x: -xStop, y: -yStop},{x: 0, y: 0}, colPos, col.strokeMedio, alphaIn,  vp);
      drawSegment(ctx, {x: -c, y: -b},        {x: -xStop, y: -yStop}, colPos, col.strokeMedio, alphaOut, vp);
      drawSegment(ctx, {x:  xStop, y: -yStop},{x: 0, y: 0}, colPos, col.strokeMedio, alphaIn,  vp);
      drawSegment(ctx, {x:  c, y: -b},        {x:  xStop, y: -yStop}, colPos, col.strokeMedio, alphaOut, vp);
    }

    // === 2.c) Arcos AZULES por los focos ===
    if (fArcoC > 0) {
      const rP = c * vp.scale * vp.userZoom;
      const angF = Math.atan2(b, c);
      ctx.save();
      ctx.strokeStyle = colPos;
      ctx.lineWidth   = col.strokeFino;
      ctx.globalAlpha = 0.5 * fArcoC * fBlueOut;
      ctx.beginPath(); ctx.arc(vp.X(0), vp.Y(0), rP, 0, -angF * fArcoC, true);                 ctx.stroke();
      ctx.beginPath(); ctx.arc(vp.X(0), vp.Y(0), rP, Math.PI, Math.PI + angF * fArcoC, false); ctx.stroke();
      ctx.beginPath(); ctx.arc(vp.X(0), vp.Y(0), rP, 0, angF * fArcoC, false);                  ctx.stroke();
      ctx.beginPath(); ctx.arc(vp.X(0), vp.Y(0), rP, Math.PI, Math.PI - angF * fArcoC, true);  ctx.stroke();
      ctx.restore();
    }

    // === 3) Escaneo + Rastro Procedural ===
    if (t >= 0.25) {
      const tau   = Math.max(0, Math.min(1, (t - 0.25) / 0.75));

      const getScannerAt = (p) => {
        let ph = 1, pf = 0;
        if (p < 0.25) { ph = 1; pf = p / 0.25; }
        else if (p < 0.50) { ph = 2; pf = (p - 0.25) / 0.25; }
        else if (p < 0.75) { ph = 3; pf = (p - 0.50) / 0.25; }
        else { ph = 4; pf = (p - 0.75) / 0.25; }

        let yE = 0, xC = 0, sX = 1;
        if (ph === 1) { yE = yStop * (1 - pf); xC = (c / b) * yE; sX = 1; }
        else if (ph === 2) { yE = yStop * pf; xC = -(c / b) * yE; sX = -1; }
        else if (ph === 3) { yE = -yStop * (1 - pf); xC = (c / b) * yE; sX = -1; }
        else { yE = -yStop * pf; xC = -(c / b) * yE; sX = 1; }

        const r = Math.sqrt(Math.max(0, b * b - yE * yE));
        return { xC, yE, r, sX, phase: ph };
      };

      if (state.showTrails) {
        const limitP = Math.min(tau, 0.5);
        const step = (state.spacing || 0.8) * 0.05;
        for (let p = 0; p <= limitP; p += step) {
          const data = getScannerAt(p);
          if (Math.sqrt(data.xC * data.xC + data.yE * data.yE) > c) continue;
          ctx.save();
          ctx.strokeStyle = '#777777';
          ctx.lineWidth = col.strokeFino;
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.arc(vp.X(data.xC), vp.Y(0), data.r * vp.scale * vp.userZoom, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      const fFadeMaquinaria = tau > 0.5 ? 0 : clamp01((0.5 - tau) * 100 + 1); 

      if (fFadeMaquinaria > 0) {
        const curr = getScannerAt(tau);
        const activo = Math.sqrt(curr.xC * curr.xC + curr.yE * curr.yE) <= c;
        const mAlpha = fFadeMaquinaria;

        drawSegment(ctx, {x: curr.xC, y: curr.yE}, {x: curr.xC, y: 0}, colRad, col.strokeMedio, 0.8 * mAlpha, vp);
        drawSegment(ctx, {x: curr.xC, y: curr.yE}, {x: 0, y: curr.yE}, colRad, col.strokeMedio, 1.0 * mAlpha, vp);
        drawPoint(ctx, curr.xC, curr.yE, colRad, 4, false, mAlpha, vp);
        drawPoint(ctx, curr.xC, 0, colRad, 4, true, mAlpha, vp);

        if (activo) {
          ctx.save();
          ctx.strokeStyle = colRad; ctx.setLineDash([5, 5]); ctx.lineWidth = col.strokeFino; ctx.globalAlpha = 0.4 * mAlpha;
          ctx.beginPath(); ctx.arc(vp.X(0), vp.Y(curr.yE), curr.r * vp.scale * vp.userZoom, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.strokeStyle = colRad; ctx.lineWidth = col.strokeMedio; ctx.globalAlpha = 0.8 * mAlpha;
          ctx.beginPath(); ctx.arc(vp.X(curr.xC), vp.Y(0), curr.r * vp.scale * vp.userZoom, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();

          const xRadExt = curr.r * curr.sX;
          drawSegment(ctx, {x: 0, y: curr.yE}, {x: xRadExt, y: curr.yE}, colRad, col.strokeGrueso, mAlpha, vp);
          drawPoint(ctx, xRadExt, curr.yE, colRad, 4, false, mAlpha, vp);
        }
      }

      const drawEllipseArc = (th0, th1) => {
        if (th1 <= th0) return;
        const steps = 200; 
        const dth = (th1 - th0) / steps;
        ctx.save();
        ctx.strokeStyle = col.ellipse; ctx.lineWidth = col.strokeGrueso;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const u = th0 + i * dth;
          const x = a * Math.cos(u);
          const y = b * Math.sin(u);
          if (i === 0) ctx.moveTo(vp.X(x), vp.Y(y)); else ctx.lineTo(vp.X(x), vp.Y(y));
        }
        ctx.stroke(); ctx.restore();
      };

      const currAny = getScannerAt(tau);
      const yAbsNorm = Math.min(1, Math.max(0, Math.abs(currAny.yE) / Math.max(yStop, 1e-9)));
      const phi = Math.acos(yAbsNorm);
      let thetaLead = 0;
      if (currAny.phase === 1) thetaLead = phi;
      else if (currAny.phase === 2) thetaLead = Math.PI - phi;
      else if (currAny.phase === 3) thetaLead = Math.PI + phi;
      else thetaLead = 2 * Math.PI - phi;

      drawEllipseArc(0, thetaLead);
    }
  });
})();