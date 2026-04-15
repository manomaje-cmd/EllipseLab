(function(){
  const G = window.ElipseLab;
  if(!G) return;

  // --- Utilidades vectoriales ---
  const sub  = (a,b) => ({x:a.x-b.x, y:a.y-b.y});
  const add  = (a,b) => ({x:a.x+b.x, y:a.y+b.y});
  const mul  = (v,s) => ({x:v.x*s, y:v.y*s});
  const len  = (v) => Math.hypot(v.x, v.y);
  const norm = (v) => { const L = len(v)||1; return {x:v.x/L, y:v.y/L}; };
  const perpL= (v) => ({x:-v.y, y: v.x});
  const TAU  = Math.PI * 2;
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const deg2rad = d => d * Math.PI / 180;

  // Easing cúbico (fade-in)
  const easeInOutCubic = t => t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;

  // === HUD DIAL NUEVO (Estilo Diámetros Conjugados) ===
  const AFF_CIRC_COLOR = '#ef4444';           // Color del knob (Rojo)
  const DIAL_GRAY      = 'rgba(156,163,175,0.35)'; 
  const DIAL_SHADOW_COLOR = 'rgba(0,0,0,0.35)';
  const DIAL_SHADOW_BLUR  = 16;
  const DIAL_SHADOW_OFFY  = 2;
  const DIAL_HALO_OUTER   = 12;
  const DIAL_HALO_ALPHA   = 0.25;

  function getDialGeomFromCanvas(canvas){
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const m = 16, R = 40, rKnob = 5; // Medidas del dial nuevo
    return { cx: w-(R+m), cy: (R+m), R, rKnob, w, h };
  }

  function drawDialHUD(ctx, vp){
    const dpr = vp.dpr || 1;
    const g = getDialGeomFromCanvas(ctx.canvas);
    G.state._hudGeom = g;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. HALO RADIAL exterior
    {
      const R0 = g.R;
      const R1 = g.R + DIAL_HALO_OUTER;
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

    // 2. SOMBRA real usando shadowBlur
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

    // 3. Disco gris
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.R, 0, TAU);
    ctx.fillStyle = DIAL_GRAY;
    ctx.fill();

    // 4. Knob Rojo
    const ang = ((G.state.thetaHud||0) % TAU + TAU) % TAU;
    const kx = g.cx + Math.cos(ang)*g.R, ky = g.cy + Math.sin(ang)*g.R;
    ctx.fillStyle = AFF_CIRC_COLOR;
    ctx.beginPath(); ctx.arc(kx, ky, g.rKnob, 0, TAU); ctx.fill();

    ctx.restore();
  }

  function isInDial(mx, my, g){ return Math.hypot(mx-g.cx, my-g.cy) <= (g.R+10); }
  function isOnKnob(mx, my, angle, g){
    const kx = g.cx+Math.cos(angle)*g.R, ky = g.cy+Math.sin(angle)*g.R;
    return Math.hypot(mx-kx, my-ky) <= (g.rKnob+6);
  }
  function updateAngleFromPointer(e, canvas){
    const rect = canvas.getBoundingClientRect();
    const g = G.state._hudGeom || getDialGeomFromCanvas(canvas);
    let ang = Math.atan2(e.clientY-rect.top-g.cy, e.clientX-rect.left-g.cx);
    if (ang < 0) ang += TAU;
    G.state.thetaHud = ang;
  }

  // === Utilidades del modo ===
  function spacingToDivs(val){
    const minD=2,maxD=32,minS=0.05,maxS=2.50;
    let d = maxD - ((val - minS)/(maxS - minS))*(maxD - minD);
    d = Math.round(Math.max(minD, d));
    return d%2!==0 ? d+1 : d;
  }
  function ellipsePointOnDirection(v, a, b){
    const denom = Math.sqrt((v.x*v.x)/(a*a) + (v.y*v.y)/(b*b)) || 1;
    return mul(v, 1/denom);
  }
  function drawPolygon(ctx, pts, color, width, alpha, vp){
    ctx.save(); ctx.globalAlpha=alpha; ctx.strokeStyle=color; ctx.lineWidth=width;
    ctx.beginPath();
    pts.forEach((p,i)=> i===0 ? ctx.moveTo(vp.X(p.x),vp.Y(p.y)) : ctx.lineTo(vp.X(p.x),vp.Y(p.y)));
    ctx.closePath(); ctx.stroke(); ctx.restore();
  }

  function drawEllipseArcParam(ctx, a, b, u0, u1, col, vp){
    let du=u1-u0; while(du<0)du+=TAU; while(du>TAU)du-=TAU; if(du<=1e-9) return;
    const step = Math.PI/90; const steps = Math.max(2, Math.ceil(du/step));
    ctx.save(); ctx.strokeStyle=col.ellipse; ctx.lineWidth=col.strokeGrueso; ctx.lineCap="round";
    ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const u=u0 + du*(i/steps), x=a*Math.cos(u), y=b*Math.sin(u);
      if(i===0) ctx.moveTo(vp.X(x),vp.Y(y)); else ctx.lineTo(vp.X(x),vp.Y(y));
    }
    ctx.stroke(); ctx.restore();
  }

  function ensureTrail(){
    if(!G.state._afinTrail){
      G.state._afinTrail = {
        raysCirc: [], raysPr: [], affin: [],
        lastMMax:-1,lastTheta:null,lastA:null,lastB:null,lastDIVS:null,lastStartIndex:null,
        sExact:0, edgeExact:0
      };
    }
    return G.state._afinTrail;
  }
  function resetTrail(){
    G.state._afinTrail = {
      raysCirc: [], raysPr: [], affin: [],
      lastMMax:-1,lastTheta:null,lastA:null,lastB:null,lastDIVS:null,lastStartIndex:null,
      sExact:0, edgeExact:0
    };
  }

  function startAnchorOnP(thetaAff){
    const sinT=Math.sin(thetaAff), cosT=Math.cos(thetaAff), tanT=Math.tan(thetaAff), eps=1e-9;
    if(Math.abs(tanT)<=1+1e-12){
      if(cosT>0){ const sy=Math.max(-1,Math.min(1,tanT)); return {edgeIdx:0, sExact:(sy+1)*0.5}; }
      else      { const sy=Math.max(-1,Math.min(1,-tanT)); return {edgeIdx:2, sExact:(sy+1)*0.5}; }
    }else{
      const cotT = Math.abs(sinT)>eps ? (cosT/sinT) : (cosT>=0?Infinity:-Infinity);
      if(sinT>0){ const sx=Math.max(-1,Math.min(1,cotT));  return {edgeIdx:1, sExact:(1 - sx)*0.5}; }
      else      { const sx=Math.max(-1,Math.min(1,-cotT)); return {edgeIdx:3, sExact:(sx + 1)*0.5}; }
    }
  }

  // === Registro del modo ===
  G.registerMode('circunferencia_afin', (ctx, state, H)=>{
    const {viewport:vp, getColors, params, drawSegment, drawCircleWorld, drawHandle, drawPoint, drawFoci} = H;
    const {a, b} = params();
    const col = getColors();

    if(G.state.thetaHud == null)   G.state.thetaHud   = deg2rad(35);
    if(G.state.thetaSense == null) G.state.thetaSense = +1;

    // Listeners del dial (actualizados)
    if(!G.state._hudBound){
      const canvas=ctx.canvas;
      const onDown=(e)=>{
        const r=canvas.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
        const g=G.state._hudGeom || getDialGeomFromCanvas(canvas);
        if(isInDial(mx,my,g) || isOnKnob(mx,my,G.state.thetaHud||0,g)){
          e.preventDefault(); e.stopPropagation();
          try{ canvas.setPointerCapture?.(e.pointerId); }catch{}
          G.state._dragDial=true; updateAngleFromPointer(e,canvas);
          canvas.style.cursor='grabbing'; G._redraw?.();
        }
      };
      const onMove=(e)=>{
        if(G.state._dragDial){
          e.preventDefault(); e.stopPropagation(); updateAngleFromPointer(e,canvas);
          canvas.style.cursor='grabbing'; G._redraw?.(); return;
        }
        const r=canvas.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
        const g=G.state._hudGeom || getDialGeomFromCanvas(canvas);
        if(isInDial(mx,my,g) || isOnKnob(mx,my,G.state.thetaHud||0,g)) canvas.style.cursor='grab';
      };
      const endDrag=(e)=>{
        if(G.state._dragDial){
          e.preventDefault(); e.stopPropagation(); G.state._dragDial=false;
          try{ canvas.releasePointerCapture?.(e.pointerId); }catch{}
          canvas.style.cursor=''; G._redraw?.();
        }
      };
      canvas.addEventListener('pointerdown', onDown, {capture:true});
      canvas.addEventListener('pointermove', onMove, {capture:true});
      canvas.addEventListener('pointerup',   endDrag,   {capture:true});
      canvas.addEventListener('pointercancel', endDrag, {capture:true});
      G.state._hudBound=true;
    }

    const thetaAff = (G.state.thetaSense || 1) * (G.state.thetaHud || 0);
    const tNorm  = clamp01(Number(state.t) || 0);
    const fadeIn = easeInOutCubic(clamp01(tNorm / 0.25));
    const sweepU = tNorm <= 0.25 ? 0 : (tNorm - 0.25) / 0.75;
    const DIVS = spacingToDivs(state.spacing);

    const cosT = Math.cos(thetaAff), sinT = Math.sin(thetaAff);
    const P = [{sx:1,sy:1},{sx:-1,sy:1},{sx:-1,sy:-1},{sx:1,sy:-1}].map(s => ({
      x: a * (cosT * s.sx + sinT * s.sy),
      y: b * (-sinT * s.sx + cosT * s.sy)
    }));

    const A = P[3], B = P[0];
    const mid = {x:(A.x+B.x)/2, y:(A.y+B.y)/2};
    const sideVec = sub(B,A), sideLen = len(sideVec);
    let nHat = norm(perpL(norm(sideVec)));
    if(mid.x*nHat.x + mid.y*nHat.y < 0) nHat = mul(nHat, -1);

    const SQ = [A, B, add(B, mul(nHat, sideLen)), add(A, mul(nHat, sideLen))];
    const radius = sideLen/2;
    const centerC = add(mid, mul(nHat, radius));

    const alphaStruct = 0.6 * fadeIn, alphaMarks = 0.8 * fadeIn, wMed = col.strokeMedio;
    drawCircleWorld(ctx, centerC.x, centerC.y, radius, AFF_CIRC_COLOR, wMed, alphaStruct, vp);
    drawPolygon(ctx, SQ, col.axis, wMed, alphaStruct, vp);
    drawPolygon(ctx, P,  col.axis, wMed, alphaStruct, vp);

    const sqEdges = [{A:SQ[0],B:SQ[1]}, {A:SQ[1],B:SQ[2]}, {A:SQ[2],B:SQ[3]}, {A:SQ[3],B:SQ[0]}];
    const prEdges = [{A:P[3],B:P[0]},   {A:P[0],B:P[1]},   {A:P[1],B:P[2]},   {A:P[2],B:P[3]}];

    for(let i=0;i<4;i++){
      const eS=sqEdges[i], eP=prEdges[i], uS=sub(eS.B,eS.A), uP=sub(eP.B,eP.A);
      for(let j=0;j<DIVS;j++){
        const s=j/DIVS;
        const pEdgeSq=add(eS.A,mul(uS,s)), pEdgePr=add(eP.A,mul(uP,s));
        drawPoint(ctx,pEdgeSq.x,pEdgeSq.y,"#333",2,false,alphaMarks,vp);
        drawPoint(ctx,pEdgePr.x,pEdgePr.y,"#333",2,false,alphaMarks,vp);
      }
    }

    if (state.showDiameters || state.showAxes) {
      const diamCol = col.circs || col.faint;
      const alpha = col.alphaTenue || 0.6;
      const lw = col.strokeFino || (1.2 * dpr);
      drawSegment(ctx, {x:-a,y:0}, {x:a,y:0}, diamCol, lw, alpha, vp);
      drawSegment(ctx, {x:0,y:-b}, {x:0,y:b}, diamCol, lw, alpha, vp);
    }
    
    if (state.showFoci) drawFoci(ctx, a, b, vp);

    const trail = ensureTrail();
    const needReset = (sweepU <= 0) ||
      (trail.lastTheta != null && Math.abs(trail.lastTheta - thetaAff) > 1e-9) ||
      (trail.lastA != null && Math.abs(trail.lastA - a) > 1e-9) ||
      (trail.lastB != null && Math.abs(trail.lastB - b) > 1e-9) ||
      (trail.lastDIVS != null && trail.lastDIVS !== DIVS);
    if(needReset) resetTrail();

    if(sweepU > 0){
      const totalSteps = 4 * DIVS;
      const { edgeIdx: edgeExact, sExact } = startAnchorOnP(thetaAff);
      let jStart = Math.round(sExact * DIVS);
      if (jStart >= DIVS) jStart = DIVS - 1;
      const startIndex = (edgeExact * DIVS + jStart) % totalSteps;
      const k = Math.floor(sweepU * totalSteps);
      const mMax = Math.min(k, totalSteps);

      trail.lastTheta = thetaAff; trail.lastA = a; trail.lastB = b;
      trail.lastDIVS = DIVS; trail.lastStartIndex = startIndex;
      trail.sExact = sExact; trail.edgeExact = edgeExact;

      let uPrev=0;
      for(let m=0; m<=mMax; m++){
        const idx = (startIndex + (m % totalSteps)) % totalSteps;
        let eIdx = Math.floor(idx / DIVS), jIn = idx % DIVS;
        let s, eS, eP, uS, uP;
        if(m===0){ eIdx=edgeExact; s=sExact; eS=sqEdges[eIdx]; eP=prEdges[eIdx]; uS=sub(eS.B,eS.A); uP=sub(eP.B,eP.A); }
        else     { s=jIn/DIVS;      eS=sqEdges[eIdx]; eP=prEdges[eIdx]; uS=sub(eS.B,eS.A); uP=sub(eP.B,eP.A); }

        const pEdgeSq=add(eS.A,mul(uS,s)), pEdgePr=add(eP.A,mul(uP,s));
        const vC=norm(sub(pEdgeSq,centerC)), Pc=add(centerC,mul(vC,radius));
        const vE=norm(pEdgePr), Pe=ellipsePointOnDirection(vE,a,b);

        if(m>trail.lastMMax){
          trail.raysCirc.push({p1:{x:centerC.x,y:centerC.y}, p2:pEdgeSq});
          trail.raysPr  .push({p1:{x:0,y:0},                 p2:pEdgePr});
          trail.affin   .push({p1:Pc,                        p2:Pe});
          trail.lastMMax=m;
        }

        let uCurr=Math.atan2((Pe.y/(b||1)), (Pe.x/(a||1))); if(uCurr<0) uCurr+=TAU;
        while(uCurr<uPrev) uCurr+=TAU; uPrev=uCurr;

        if((m===mMax)&&(mMax<totalSteps)){
          const alphaActive=0.95, wActive=Math.max(col.strokeMedio, 2.0*(vp.dpr||1));
          H.drawSegment(ctx, centerC, pEdgeSq, AFF_CIRC_COLOR, wActive, alphaActive, vp);
          H.drawPoint  (ctx, Pc.x, Pc.y, AFF_CIRC_COLOR, 2.6, false, alphaActive, vp);
          H.drawSegment(ctx, {x:0,y:0}, pEdgePr, col.ellipse, wActive, alphaActive, vp);
          H.drawSegment(ctx, Pc, Pe, "#64748b", wActive, alphaActive, vp);
          H.drawPoint  (ctx, Pe.x, Pe.y, col.ellipse, 2.6, false, alphaActive, vp);
        }
      }

      if(state.showTrails){
        const faintAlpha=0.28, lw=col.strokeFino;
        for(const seg of trail.raysCirc) H.drawSegment(ctx, seg.p1, seg.p2, AFF_CIRC_COLOR, lw, faintAlpha, vp);
        for(const seg of trail.raysPr)   H.drawSegment(ctx, seg.p1, seg.p2, col.ellipse, lw, faintAlpha, vp);
        for(const seg of trail.affin)    H.drawSegment(ctx, seg.p1, seg.p2, "#64748b", lw, faintAlpha, vp);
      }
      if(mMax===totalSteps) uPrev = TAU;
      drawEllipseArcParam(ctx, a, b, 0, uPrev, col, vp);
    } else { resetTrail(); }

    drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp);
    drawDialHUD(ctx, vp);
  });
})();