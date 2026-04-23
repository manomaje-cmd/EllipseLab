(function(){
  if(!window.ElipseLab) return;
  const G = window.ElipseLab;

  // --------- Configuración con Rastro opcional ---------
  const T_SEC     = 3;          
  const COL = {
    cuerdaIzq:   "#4aa7ff",
    cuerdaDer:   "#ffb347",
    bisectriz:   "#ff00ff", // Color vibrante para la bisectriz
    rastro:      "rgba(100, 100, 100, 0.9)",
    bolita:      "#707070",
    barLeft:     "#4aa7ff",
    barRight:    "#ffb347",
    aura:        "rgba(0,0,0,0.0)"
  };

  let builtA=null, builtB=null, builtSpacing=null;
  let chords=[];     
  let startMs=0;     
  let running=false;

  function rebuild(a, b, spacing){
    const R_NUM = Math.round(120 / (spacing * 5));
    const c = Math.sqrt(Math.max(0,a*a-b*b));
    const F1 = {x:-c,y:0}, F2={x:c,y:0};
    const arr=[];
    for(let i=0;i<R_NUM;i++){
      const u = (i/R_NUM)*Math.PI*2;
      const Px = a*Math.cos(u), Py = b*Math.sin(u);
      arr.push({Px, Py, dL:Math.hypot(Px-F1.x, Py-F1.y), dR:Math.hypot(F2.x-Px, F2.y-Py), u});
    }
    chords=arr; builtA=a; builtB=b; builtSpacing=spacing; running=false;
  }

  if(!G._rafJardinero){
    G._rafJardinero = true;
    (function loop(){
      if(G.state?.activeLayers?.includes('jardinero')) G._redraw?.();
      requestAnimationFrame(loop);
    })();
  }

  G.registerMode('jardinero', (ctx, state, H)=>{
    const {viewport:vp, getColors, params, drawSegment, drawPoint,
            drawHandle, clamp01, drawFoci, drawAxesExact} = H;

    const {a,b,c} = params();
    const col = getColors();
    const t = Number(state.t)||0;

    const fFociFade   = clamp01((t - 0.05) * 14);
    const fCuerdaProg = clamp01((t - 0.12) * 16);
    const fCuerdaTens = clamp01((t - 0.18) * 14);
    const fGiro       = clamp01((t - 0.25) / 0.75);
    const fOndasIntro = clamp01((t - 0.92) * 12); 

    const spacing = state.spacing || 0.80;
    if(a!==builtA || b!==builtB || spacing!==builtSpacing) rebuild(a, b, spacing);

    drawHandle(ctx, a, 0, "#ff4444", 'h', 1, vp);

    if (state.showAxes) drawAxesExact(ctx, a, b, vp);

    // 1) La Elipse
    if (fGiro > 0) {
      ctx.save();
      ctx.strokeStyle = col.ellipse;
      ctx.lineWidth   = col.strokeGrueso;
      ctx.beginPath();
      const uMax = fGiro * Math.PI * 2;
      for(let u=0; u<=uMax; u+=0.04){
        const x = a*Math.cos(u), y = b*Math.sin(u);
        u===0 ? ctx.moveTo(vp.X(x), vp.Y(y)) : ctx.lineTo(vp.X(x), vp.Y(y));
      }
      ctx.stroke();
      ctx.restore();
    }

    // 2) Cuerdas, Rastro y Bisectriz
    if (fCuerdaProg > 0) {
      const uAct = fGiro * Math.PI * 2;
      const P  = { x: a*Math.cos(uAct), y: b*Math.sin(uAct) };
      const F1 = { x: -c, y: 0 };
      const F2 = { x:  c, y: 0 };

      const showTrails = (state.showTrails ?? true);
      const trColor = (col.traceColor ?? COL.rastro);
      const trWidth = (col.traceWidth ?? col.strokeFino ?? 1);
      const trAlpha = (col.traceAlpha ?? 0.5);

      if (showTrails) {
        for(const ch of chords){
          if(ch.u <= uAct){
            const Pi = {x:ch.Px, y:ch.Py};
            drawSegment(ctx, F1, Pi, trColor, trWidth, trAlpha, vp);
            drawSegment(ctx, Pi, F2, trColor, trWidth, trAlpha, vp);
          }
        }
      }

      // Cuerdas principales
      const op = 1 - (fOndasIntro * 0.7);
      drawSegment(ctx, F2, (fCuerdaTens>0? P : {x:a,y:0}), COL.cuerdaDer, col.strokeMedio*2, fCuerdaProg*op, vp);

      if (fCuerdaTens > 0) {
        drawSegment(ctx, F1, P, COL.cuerdaIzq, col.strokeMedio*2, fCuerdaTens*op, vp);
        
        // --- NORMAL (Sincronizada con modo Osculatriz) ---
        const cosT = Math.cos(uAct), sinT = Math.sin(uAct);
        const nxRaw = b * cosT, nyRaw = a * sinT;
        const nDist = Math.sqrt(nxRaw * nxRaw + nyRaw * nyRaw);

        if (nDist > 1e-9) {
            // ux, uy apuntando hacia afuera (estándar de la elipse)
            const ux = nxRaw / nDist, uy = nyRaw / nDist;
            
            const largo = a * 1.5; 
            // P2 es el extremo largo, P1_ext el corto (ajusta signos si quieres invertir la dirección)
            const P2 = { x: P.x - ux * largo, y: P.y - uy * largo }; 
            const P1_ext = { x: P.x + ux * (largo / 4), y: P.y + uy * (largo / 4) };

            ctx.save();
            ctx.setLineDash([12, 4, 2, 4]); 
            ctx.lineCap = "round"; 
            drawSegment(ctx, P1_ext, P2, COL.bisectriz, col.strokeFino, fCuerdaTens * 0.8, vp);
            ctx.restore();
        }

        drawPoint(ctx, P.x, P.y, col.ellipse, col.jointSize, true, op, vp);
      }

      // 4) LA ONDA
      if (fOndasIntro > 0.8 && !running) {
        startMs = performance.now();
        running = true;
      }

      if (running){
        const elapsed = (performance.now() - startMs)/1000;
        const dist = (2*a / T_SEC) * elapsed;

        for(const ch of chords){
          let px, py;
          if (dist <= ch.dL){
            const s = dist / ch.dL;
            px = F1.x + (ch.Px - F1.x)*s; py = F1.y + (ch.Py - F1.y)*s;
          } else if (dist < (ch.dL + ch.dR)){
            const s = (dist - ch.dL) / ch.dR;
            px = ch.Px + (F2.x - ch.Px)*s; py = ch.Py + (F2.y - ch.Py)*s;
          } else {
            px = F2.x; py = F2.y;
          }
          drawPoint(ctx, px, py, COL.aura, 2, false, 0.25, vp);
          drawPoint(ctx, px, py, COL.bolita, 2, false, 0.9, vp);
        }
        if (t < 0.85) running = false;
      }
    }

    if (fFociFade > 0) {
      ctx.save(); ctx.globalAlpha = fFociFade; drawFoci(ctx, a, b, vp); ctx.restore();
    }

    // 5) BARRA INDICADORA
    if (fCuerdaTens > 0) {
      const dpr   = vp.dpr || 1;
      const barCSSY  = vp.toCSSY(-b) + 28;
      const barCSSX0 = vp.toCSSX(-a);
      const barCSSX1 = vp.toCSSX( a);
      const uAct = fGiro * Math.PI * 2;
      const Pbar = { x: a*Math.cos(uAct), y: b*Math.sin(uAct) };
      const F1b  = { x: -c, y: 0 };
      const F2b  = { x:  c, y: 0 };
      const dLive  = Math.hypot(Pbar.x - F1b.x, Pbar.y - F1b.y);
      const dRive  = Math.hypot(F2b.x  - Pbar.x, F2b.y  - Pbar.y);
      const total  = dLive + dRive;
      const splitF = total > 0 ? dLive / total : 0.5;

      const barH   = 6 * dpr;
      const radius = 2 * dpr;
      const alpha  = fCuerdaTens;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = alpha;
      const x0 = barCSSX0 * dpr;
      const x1 = barCSSX1 * dpr;
      const y0 = barCSSY  * dpr - barH / 2;
      const xS = x0 + (x1 - x0) * splitF;

      ctx.fillStyle = COL.cuerdaIzq;
      ctx.beginPath();
      ctx.roundRect(x0, y0, xS - x0, barH, [radius, 0, 0, radius]);
      ctx.fill();

      ctx.fillStyle = COL.cuerdaDer;
      ctx.beginPath();
      ctx.roundRect(xS, y0, x1 - xS, barH, [0, radius, radius, 0]);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = alpha * 0.95;
      ctx.fillRect(xS - 1 * dpr, y0 - 1 * dpr, 2 * dpr, barH + 2 * dpr);
      ctx.restore();
    }
  });
})();
