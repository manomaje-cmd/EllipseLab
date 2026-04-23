// js/core.js — Versión 6.0.2‑VS0b
//   Fixes heredados de 6.0.1:
//   1. Paneo vertical corregido: userPanY -= dy (no +=)
//   2. toCSSX/toCSSY añadidos al viewport (mundo → CSS Y↓)
//   3. toWorldY corregido para Y-flip
//   4. Hit-test tiradores usa toCSSX/toCSSY
//   5. drawHandle no hace scale global; refleja Y localmente

(function(){
  const G = (window.ElipseLab = window.ElipseLab || {});

  // ===== Estado global =====
  const state = {
    a: 150, b: 100,
    mode: 'projective_deformable',
    activeLayers: ['projective_deformable'],
    t: 1.0, spacing: 0.80, skewX: 0, phi: Math.PI/6, phi2: Math.PI/6 + Math.PI/3,
    showAxes: false,
    showTrails: false
  };
  Object.defineProperty(state, 'showDiameters', {
    get(){ return this.showAxes; },
    set(v){ this.showAxes = !!v; }
  });
  state.setSkewX = (val) => { state.skewX = val; };
  state.getSkewX = () => state.skewX;

  // --- Límite global de excentricidad (histórico): e_max = 0.9642
  const E_MAX  = 0.9642;
  const S_MIN  = Math.sqrt(Math.max(0, 1 - E_MAX*E_MAX)); // ≈ 0.2666 (b/a mínimo)
  const B_FIXED = 100;          // Comportamiento clásico: b fijo
  const A_MAX   = B_FIXED / S_MIN; // ≈ 375

  // [VS0] λ mínimo para respetar S_MIN:  b/a = λ/(2-λ) >= S_MIN  ⇒  λ >= 2*S_MIN/(1+S_MIN)
  const LAMBDA_MIN = (2 * S_MIN) / (1 + S_MIN);

  // ===== Colores y grosores =====
  function getColors(){
    const cs = getComputedStyle(document.documentElement);
    const pick = k => (cs.getPropertyValue(k)||'').trim();
    const dpr = window.devicePixelRatio || 1;

    // [AXES] Lee grosor de ejes de elipse (px CSS → escala dpr). Si no está, será null.
    const ellipseAxesWidthVar = parseFloat(pick('--ellipse-axes-width'));
    const ellipseAxesWidth = isNaN(ellipseAxesWidthVar) ? null : ellipseAxesWidthVar * dpr;

    return {
      axis:    pick('--axis')   ||'#000',
      circs:   pick('--circs')  ||'#000',
      faint:   pick('--faint')  ||'#818181',
      ellipse: pick('--ellipse')||'#2563eb',
      foci:    pick('--foci')   ||'#b45309',
      bg:      pick('--bg')     ||'#fff',
      label:   pick('--label')  ||'#515152',

      alphaTenue:  1.0,
      alphaMedio:  1.0,
      alphaFuerte: 1.0,

      strokeFino:   1   * dpr,
      strokeMedio:  1.5 * dpr,
      strokeGrueso: 3.3 * dpr,

      traceAlpha: 1.0,
      traceWidth: 1.2 * dpr,
      traceColor: pick('--faint')||'#818181',

      barColor: "#c2410c",
      barWidth: 2.5 * dpr,
      barAlpha: 1.0,
      jointSize: 3.5 * dpr,

      // [AXES] Campo específico para ejes de la elipse
      ellipseAxesWidth
    };
  }

  // ===== Viewport =====
  const viewport = (function(){
    let dpr=1, cssW=0, cssH=0, margin=40, scale=1;
    let _xMin=0, _xMax=0, _yMin=0, _yMax=0;
    let userPanX=0, userPanY=0, userZoom=1;
    let autoScaleInitialized=false;
    let _originX=0, _originY=0;

    return {
      setSize(w, h){ dpr=window.devicePixelRatio||1; cssW=w; cssH=h; },

      setWindowByEllipse(a, b){
        if(autoScaleInitialized) return;
        const reach=Math.max(a,b)*1.8;
        _xMin=-reach; _xMax=reach; _yMin=-reach; _yMax=reach;
        scale=Math.min(
          (cssW-200)/(_xMax-_xMin),
          (cssH-100)/(_yMax-_yMin)
        );
        _originX=margin+50+(-_xMin)*scale;
        _originY=cssH/2;
        autoScaleInitialized=true;
      },

      // Mundo → pantalla (modo Y↑ en los modos; aquí convertimos)
      X(x){ return _originX+(x+userPanX)*scale*userZoom; },
      Y(y){ return _originY+(y+userPanY)*scale*userZoom; },

      // Mundo → CSS Y↓ (para hit-test)
      toCSSX(wx){ return _originX+(wx+userPanX)*scale*userZoom; },
      toCSSY(wy){ return cssH-(_originY+(wy+userPanY)*scale*userZoom); },

      // CSS → mundo
      toWorldX(px){ return (px-_originX)/(scale*userZoom)-userPanX; },
      toWorldY(py){ return (cssH-py-_originY)/(scale*userZoom)-userPanY; },

      resetScale(){ autoScaleInitialized=false; },

      get dpr()     { return dpr; },
      get cssH()    { return cssH; },
      get scale()   { return scale; },
      get userPanX(){ return userPanX; }, set userPanX(v){ userPanX=v; },
      get userPanY(){ return userPanY; }, set userPanY(v){ userPanY=v; },
      get userZoom(){ return userZoom; }, set userZoom(z){ userZoom=z; },
      get margin()  { return margin; },
      get _xMin()   { return _xMin; },
      get _yMax()   { return _yMax; },
      get _originX(){ return _originX; },
      get _originY(){ return _originY; },
    };
  })();

  // ===== Helpers de dibujo =====
  function drawHandle(ctx, wx, wy, color, dir='h', alpha=1, vp=viewport){
    const dpr = vp.dpr || 1;
    const size = 8 * dpr; const gap = 8 * dpr; const extraOffset = 10 * dpr;
    const cssX = vp.toCSSX(wx);
    const cssY = vp.toCSSY(wy);
    const px = cssX * dpr;
    const py = cssY * dpr;

    ctx.save();
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.2 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if(dir === 'h'){
      const offX = px + extraOffset;
      ctx.beginPath(); ctx.moveTo(offX-gap,py); ctx.lineTo(offX-gap+size,py-size/1.5); ctx.lineTo(offX-gap+size,py+size/1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(offX+gap,py); ctx.lineTo(offX+gap-size,py-size/1.5); ctx.lineTo(offX+gap-size,py+size/1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      const offY = py - extraOffset;
      ctx.beginPath(); ctx.moveTo(px,offY-gap); ctx.lineTo(px-size/1.5,offY-gap+size); ctx.lineTo(px+size/1.5,offY-gap+size); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px,offY+gap); ctx.lineTo(px-size/1.5,offY+gap-size); ctx.lineTo(px+size/1.5,offY+gap-size); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawSegment(ctx, p1, p2, color, width=1, alpha=1, vp=viewport){
    ctx.save(); ctx.globalAlpha=alpha; ctx.strokeStyle=color; ctx.lineWidth=width;
    ctx.beginPath(); ctx.moveTo(vp.X(p1.x),vp.Y(p1.y)); ctx.lineTo(vp.X(p2.x),vp.Y(p2.y)); ctx.stroke(); ctx.restore();
  }

  function drawPoint(ctx, x, y, color, r=3, outline=false, alpha=1, vp=viewport){
    ctx.save(); ctx.globalAlpha=alpha;
    ctx.beginPath(); ctx.arc(vp.X(x), vp.Y(y), r*(vp.dpr||1), 0, Math.PI*2);
    if(outline){ ctx.lineWidth=1.6*(vp.dpr||1); ctx.strokeStyle=color; ctx.stroke(); ctx.fillStyle="#fff"; ctx.fill(); }
    else { ctx.fillStyle=color; ctx.fill(); }
    ctx.restore();
  }

  function drawEllipse(ctx, a, b, color, width=2, vp=viewport){
    ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=width;
    ctx.lineCap="round"; ctx.lineJoin="round";
    ctx.beginPath();
    for(let i=0;i<=360;i+=2){
      const rad=i*Math.PI/180;
      const x=vp.X(a*Math.cos(rad)), y=vp.Y(b*Math.sin(rad));
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.stroke(); ctx.restore();
  }

  function drawFoci(ctx, a, b, vp=viewport){
    const c=Math.sqrt(Math.max(0,a*a-b*b)); const col=getColors();
    drawPoint(ctx,-c,0,col.foci,4,false,col.alphaMedio,vp);
    drawPoint(ctx, c,0,col.foci,4,false,col.alphaMedio,vp);
  }

  function drawAxesExact(ctx, a, b, vp=viewport){
    const col=getColors();
    // [AXES] solo para ejes de la elipse: ancho específico (CSS) o, si no hay, más grueso por defecto
    const axisW = col.ellipseAxesWidth ?? col.strokeMedio;
    drawSegment(ctx,{x:-a,y:0},{x:a,y:0},col.axis,axisW,col.alphaTenue,vp);
    drawSegment(ctx,{x:0,y:-b},{x:0,y:b},col.axis,axisW,col.alphaTenue,vp);
    drawHandle(ctx,a,0,"#ff0000",'h',1,vp);
  }

  // drawLabel legible (deshace Y-flip local)
  function drawLabel(ctx, px, py, text, options={}, vp=viewport){
    const { align='center', baseline='middle', size=14, bold=true,
            color=getColors().label, alpha=1, box=null } = options;
    const dpr=vp.dpr||1;
    ctx.save(); ctx.globalAlpha=alpha;
    ctx.transform(1, 0, 0, -1, 0, 2*py);
    const pyF=py;
    ctx.font=`${bold?'bold ':''}${Math.round(size*dpr)}px sans-serif`;
    ctx.textAlign=align; ctx.textBaseline=baseline;
    if(box){
      const pad=(box.paddingPx??6)*dpr; const radius=(box.radiusPx??6)*dpr;
      const metrics=ctx.measureText(text);
      const h=Math.round(size*dpr)+2*pad; const w=metrics.width+2*pad;
      let bx=px, by=pyF;
      if(align==='center') bx=px-w/2; else if(align==='right') bx=px-w;
      if(baseline==='middle') by=pyF-h/2; else if(baseline==='bottom') by=pyF-h;
      if(box.fill){
        ctx.save(); ctx.globalAlpha*=(box.alpha??0.9); ctx.fillStyle=box.fill;
        ctx.beginPath();
        ctx.moveTo(bx+radius,by); ctx.lineTo(bx+w-radius,by); ctx.quadraticCurveTo(bx+w,by,bx+w,by+radius);
        ctx.lineTo(bx+w,by+h-radius); ctx.quadraticCurveTo(bx+w,by+h,bx+w-radius,by+h);
        ctx.lineTo(bx+radius,by+h); ctx.quadraticCurveTo(bx,by+h,bx,by+h-radius);
        ctx.lineTo(bx,by+radius); ctx.quadraticCurveTo(bx,by,bx+radius,by);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      ctx.fillStyle=color; ctx.fillText(text,px,pyF);
    } else { ctx.fillStyle=color; ctx.fillText(text,px,pyF); }
    ctx.restore();
  }

  function drawLabelAlongSegment(ctx, p1, p2, text, offsetPx=14, side=1, options={}, vp=viewport){
    const ang=Math.atan2(p2.y-p1.y, p2.x-p1.x);
    const nx=-Math.sin(ang), ny=Math.cos(ang);
    const mid={x:(p1.x+p2.x)/2, y:(p1.y+p2.y)/2};
    const offWorld=(offsetPx/(vp.scale*vp.userZoom))*side;
    const qx=mid.x+nx*offWorld, qy=mid.y+ny*offWorld;
    drawLabel(ctx, vp.X(qx), vp.Y(qy), text, options, vp);
  }

  // ===== Distancia Punto-Segmento para clics =====
  function distToSegment(p, a, b) {
    const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
    if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
  }

  // ===== Arcos =====
  function angleNorm(a){ a%=(2*Math.PI); return a<0?a+2*Math.PI:a; }
  function angleDeltaCCW(from,to){ let d=angleNorm(to)-angleNorm(from); if(d<0) d+=2*Math.PI; return d; }

  function drawArcWorld(ctx, cx, cy, r, startTheta, endTheta, options={}, vp=viewport){
    const col=getColors();
    const color   =options.color   ??col.circs;
    const width   =options.width   ??col.strokeFino;
    const alpha   =options.alpha   ??col.alphaMedio;
    const segments=options.segments??240;
    const TAU=2*Math.PI;
    let delta=angleDeltaCCW(startTheta,endTheta);
    if(options.fullCircle===true||Math.abs(endTheta-startTheta)>=TAU-1e-6) delta=TAU;
    if(delta<=1e-9) return;
    const steps=Math.max(2,Math.round(segments*(delta/TAU)));
    ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=width; ctx.globalAlpha=alpha;
    ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const th=startTheta+(delta*i)/steps;
      const x=cx+r*Math.cos(th), y=cy+r*Math.sin(th);
      if(i===0) ctx.moveTo(vp.X(x),vp.Y(y)); else ctx.lineTo(vp.X(x),vp.Y(y));
    }
    ctx.stroke(); ctx.restore();
  }

  function drawCircleWorld(ctx, cx, cy, r, color, width, alpha, vp=viewport){
    drawArcWorld(ctx,cx,cy,r,0,2*Math.PI,{color,width,alpha,segments:360,fullCircle:true},vp);
  }

  // ===== Registro de modos =====
  const MODES=new Map();

  // ===== Redibujado =====
  function makeRedraw(canvas, ctx){
    return ()=>{
      const w=canvas.clientWidth, h=canvas.clientHeight;
      viewport.setSize(w, h);
      viewport.setWindowByEllipse(state.a, state.b);

      const dpr=viewport.dpr;
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,canvas.width,canvas.height);

      // Y-flip global: Y↑ en modos
      ctx.setTransform(dpr, 0, 0, -dpr, 0, canvas.height);

      const safeState={
        ...state,
        t:       Number(state.t),
        spacing: Number(state.spacing),
        a:       Number(state.a),
        b:       Number(state.b)
      };
      state.activeLayers.forEach(layerId=>{
        const entry=MODES.get(layerId);
        if(entry){ try{ entry.draw(ctx,safeState,helpers); } catch(e){ console.error("Error en capa:",layerId,e); } }
      });
ctx.save(); // Guardamos el estado actual
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset del Y-flip para texto normal
      
      const col = getColors();
      const txtNombre = "ElipseLab © 2026 por Manuel Sanmartín Fernández";
      const txtLicencia = "Licencia CC BY-NC-SA 4.0";
      
      ctx.font = `${11 * dpr}px sans-serif`; // Un poco más pequeño queda más elegante
      ctx.fillStyle = col.label;
      ctx.globalAlpha = 0.5; // Un toque de transparencia para que no distraiga
      ctx.textAlign = "right";
      
      // Dibujamos sobre el lienzo limpio
      ctx.fillText(txtNombre, (canvas.width/dpr) - 20, (canvas.height/dpr) - 35);
      ctx.fillText(txtLicencia, (canvas.width/dpr) - 20, (canvas.height/dpr) - 20);
      
      ctx.restore(); // Restauramos para el siguiente frame
    };
  }

  // ===== Helpers expuestos a modos =====
  const helpers={
    viewport, getColors,
    drawPoint, drawSegment, drawHandle, drawAxesExact, drawFoci, drawEllipse,
    drawLabel, drawLabelAlongSegment,
    angleNorm, angleDeltaCCW, drawArcWorld, drawCircleWorld,
    params:()=>{ const a=Number(state.a),b=Number(state.b); return {a,b,c:Math.sqrt(Math.max(0,a**2-b**2))}; },
    clamp01: x=>Math.max(0,Math.min(1,x)),
    easeInOutCubic: t=>t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2
  };

  // ===== Interacción =====
  function eventToWorld(ev, canvas){
    const rect=canvas.getBoundingClientRect();
    const mx=ev.clientX-rect.left;
    const my=ev.clientY-rect.top;
    return { worldX:viewport.toWorldX(mx), worldY:viewport.toWorldY(my), mx, my };
  }

  // ===== Límites globales =====
  function enforceEccentricityLimit(preserve = 'auto'){
    // [VS0] guiado_ortogonal: usa (R,λ) y límites; NO bloquea b=100
    if (state.activeLayers.includes('guiado_ortogonal')) {
      if (state._vs0_Rfix == null) state._vs0_Rfix = (state.a + state.b) / 2;
      const R = state._vs0_Rfix;
      let lam = (typeof state._vs0_lambda === 'number') ? state._vs0_lambda : (R>0 ? state.b / R : 0.5);
      lam = Math.max(LAMBDA_MIN, Math.min(1, lam));
      state._vs0_lambda = lam;

      state.a = (2 - lam) * R;
      state.b = (    lam) * R;

      // b mínimo de seguridad
      if (state.b < 40) {
        state.b = 40;
        const lam2 = Math.max(LAMBDA_MIN, Math.min(1, state.b / R));
        state._vs0_lambda = lam2;
        state.a = (2 - lam2) * R;
        state.b = (    lam2) * R;
      }
      return;
    }

    // === Resto de modos: comportamiento clásico ===
    state.b = B_FIXED;
    if (state.a < B_FIXED) state.a = B_FIXED;
    if (state.a > A_MAX)   state.a = A_MAX;
  }

  // ===== API pública =====
  Object.assign(G,{
    state, viewport, getColors,
    drawPoint, drawSegment, drawHandle, drawEllipse, drawFoci, drawAxesExact,
    drawLabel, drawLabelAlongSegment,
    angleNorm, angleDeltaCCW, drawArcWorld, drawCircleWorld,

    registerMode:(id,config)=>MODES.set(id,typeof config==='function'?{draw:config}:config),

    enableFallbackDraw:(canvas)=>{
      const ctx=canvas.getContext('2d');
      const redraw=makeRedraw(canvas,ctx);
      G._redraw=redraw;

      let dragTarget=null;
      let lastX=0, lastY=0;
      const grabOffset={a:0,b:0,skew:0,phi:0,phi2:0};
      const activeTouches=new Map();
      let pinchBaseline=null;

      function hitTestHandles(mx, my){
        const dpr=viewport.dpr||1;
        const tol=45*dpr;
        const offCSS=25; // offset del tirador en px CSS

        // Posiciones en CSS Y↓
        const pxA=viewport.toCSSX(state.a)+offCSS,  pyA=viewport.toCSSY(0);
        const pxS=viewport.toCSSX(state.a+state.skewX)+offCSS, pyS=viewport.toCSSY(state.b);

        // (hipotrocoide2 y guiado oblicuo da Vinci) Puntos A/B - INDEPENDIENTES
if((state.activeLayers.includes('hipotrocoide2') || state.activeLayers.includes('guiado_oblicuo_davinci')) && state.t >= 0.25){
  const rHire = Math.abs(state.a - state.b) / 2;
  const fGiro = Math.max(0, Math.min(1, (state.t - 0.25) / 0.75));
  const th = fGiro * Math.PI * 2;
  const cHx = (state.a - state.b) * Math.cos(th) / 2;
  const cHy = (state.b - state.a) * Math.sin(th) / 2;
  const Px = state.a * Math.cos(th), Py = state.b * Math.sin(th);

  // Pies de tangencia exactos (igual que antes)
  const _tmx=(Px+cHx)/2, _tmy=(Py+cHy)/2;
  const _rt=Math.sqrt((Px-cHx)**2+(Py-cHy)**2)/2;
  const _distH2=Math.sqrt((cHx-_tmx)**2+(cHy-_tmy)**2);
  let tFH=[];
  if(_distH2>1e-9 && _distH2<=rHire+_rt+1e-9 && _distH2>=Math.abs(rHire-_rt)-1e-9){
    const _a2=(rHire*rHire-_rt*_rt+_distH2*_distH2)/(2*_distH2);
    const _h=Math.sqrt(Math.max(0,rHire*rHire-_a2*_a2));
    const _ex=(cHx-_tmx)/_distH2,_ey=(cHy-_tmy)/_distH2,_bx=cHx+_a2*_ex,_by=cHy+_a2*_ey;
    tFH=[{x:_bx+_h*_ey,y:_by-_h*_ex},{x:_bx-_h*_ey,y:_by+_h*_ex}];
  }

  function _lcpHit(ang,cx,cy,r){
    const ca=Math.cos(ang),sa=Math.sin(ang),bC=-2*(ca*cx+sa*cy),cC=cx*cx+cy*cy-r*r,disc=bC*bC-4*cC;
    if(disc<0)return null;
    const tVal=Math.abs((-bC+Math.sqrt(disc))/2)>Math.abs((-bC-Math.sqrt(disc))/2)?(-bC+Math.sqrt(disc))/2:(-bC-Math.sqrt(disc))/2;
    return{x:tVal*ca,y:tVal*sa};
  }

  // ── Da Vinci (si está activo) ──
  if (state.activeLayers.includes('guiado_oblicuo_davinci')) {
    const phiPt  = state._dvPhi1Dragged ? _lcpHit(state.phi_dv,  cHx,cHy,rHire) : (tFH[1]||null);
    const phi2Pt = state._dvPhi2Dragged ? _lcpHit(state.phi2_dv, cHx,cHy,rHire) : (tFH[0]||null);
    if(phiPt){  const ppx=viewport.toCSSX(phiPt.x), ppy=viewport.toCSSY(phiPt.y); if(Math.hypot(mx-ppx,my-ppy)<tol) return 'phi_dv'; }
    if(phi2Pt){ const ppx=viewport.toCSSX(phi2Pt.x), ppy=viewport.toCSSY(phi2Pt.y); if(Math.hypot(mx-ppx,my-ppy)<tol) return 'phi2_dv'; }
  }

  // ── Hipotrocoide (si está activo) ──
  if (state.activeLayers.includes('hipotrocoide2')) {
    const phiPt  = state._hipoPhi1Dragged ? _lcpHit(state.phi_hipo,  cHx,cHy,rHire) : (tFH[1]||null);
    const phi2Pt = state._hipoPhi2Dragged ? _lcpHit(state.phi2_hipo, cHx,cHy,rHire) : (tFH[0]||null);
    if(phiPt){  const ppx=viewport.toCSSX(phiPt.x), ppy=viewport.toCSSY(phiPt.y); if(Math.hypot(mx-ppx,my-ppy)<tol) return 'phi_hipo'; }
    if(phi2Pt){ const ppx=viewport.toCSSX(phi2Pt.x), ppy=viewport.toCSSY(phi2Pt.y); if(Math.hypot(mx-ppx,my-ppy)<tol) return 'phi2_hipo'; }
  }
}

        // Handle del trazador de la normal en hipotrocoide2
        if ((state.activeLayers.includes('hipotrocoide2') || state.activeLayers.includes('osculatriz')) && state.t >= 0.25) {
          const fGiroN = Math.max(0, Math.min(1, (state.t - 0.25) / 0.75));
          const thN = fGiroN * Math.PI * 2;
          const aN = state.a, bN = state.b;
          const PxN = aN * Math.cos(thN), PyN = bN * Math.sin(thN);
          const nxR = bN * Math.cos(thN), nyR = aN * Math.sin(thN);
          const nD = Math.sqrt(nxR*nxR + nyR*nyR);
          if (nD > 1e-9) {
            const uxN = nxR/nD, uyN = nyR/nD;
            const off = (typeof state.offsetNormal === 'number') ? state.offsetNormal : -(bN*bN)/aN;
            const TrX = PxN + uxN * off, TrY = PyN + uyN * off;
            const ppx = viewport.toCSSX(TrX), ppy = viewport.toCSSY(TrY);
            if (Math.hypot(mx-ppx, my-ppy) < tol) return 'normalTracer';
          }
        }

                // Handle del trazador en guiado_ortogonal (punto sobre D→M)
        if (state.activeLayers.includes('guiado_ortogonal') && state.t >= 0.25) {
          if (state._vs0_Rfix == null) state._vs0_Rfix = (state.a + state.b) / 2;
          const R = state._vs0_Rfix;

          const fGiro = Math.max(0, Math.min(1, (state.t - 0.25) / 0.75));
          const th = fGiro * Math.PI * 2;
          const M = { x: R * Math.cos(th),     y: R * Math.sin(th) };
          const D = { x: 2 * R * Math.cos(th), y: 0 };

          const lam = (typeof state._vs0_lambda === 'number')
                      ? state._vs0_lambda
                      : (R>0 ? Math.max(LAMBDA_MIN, Math.min(1, state.b / R)) : 0.5);

          const Px = D.x + (M.x - D.x) * lam;
          const Py = D.y + (M.y - D.y) * lam;

          const ppx = viewport.toCSSX(Px);
          const ppy = viewport.toCSSY(Py);
          if (Math.hypot(mx-ppx, my-ppy) < tol) return 'vs0_tracer';
        }

        // ----- handles generales -----
        if(Math.hypot(mx-pxS,my-pyS)<tol) return 'skew';
        if(Math.hypot(mx-pxA,my-pyA)<tol) return 'a';
        return null;
      }

      canvas.addEventListener('pointerdown', (ev) => {
        const rect = canvas.getBoundingClientRect();
        const xCSS = ev.clientX - rect.left;
        const yCSS = ev.clientY - rect.top;

        // --- 1. DETECTOR DEL BOTÓN "MOSTRAR OCULTOS" ---
        // (Ubicado abajo a la izquierda)
        const btnW = 140, btnH = 30, btnX = 10;
        const btnY = rect.height - 40; 

        if (xCSS >= btnX && xCSS <= (btnX + btnW) &&
            yCSS >= btnY && yCSS <= (btnY + btnH)) {
            
            // Esto cambia el modo: de "no ver nada" a "ver fantasmas tenues"
            state.showHidden = !state.showHidden;
            
            if (G.syncPanel) G.syncPanel();
            if (G._redraw) G._redraw();

            ev.preventDefault();
            ev.stopPropagation();
            return; // Salimos aquí para que no detecte clics en varas debajo
        }

        // --- 2. DETECTOR DE TIRADORES Y VARAS ---
        // Primero calculamos mx y my (que antes daban error por no estar definidos aquí)
        const mx = xCSS * (canvas.width / rect.width) / (viewport.dpr || 1);
        const my = yCSS * (canvas.height / rect.height) / (viewport.dpr || 1);

        const hit = hitTestHandles(mx, my);
        if (hit) {
          if (ev.button !== 0) return;
          dragTarget = hit;
          state._dragTarget = hit;
          const { worldX, worldY } = eventToWorld(ev, canvas);
          const offW = 25 / (viewport.scale * viewport.userZoom);
          
          if (dragTarget === 'a') grabOffset.a = worldX - (state.a + offW);
          else if (dragTarget === 'skew') grabOffset.skew = worldX - (state.a + state.skewX + offW);
          else if (dragTarget === 'phi') grabOffset.phi = 0;
          else if (dragTarget === 'phi_dv') grabOffset.phi_dv = 0;
          else if (dragTarget === 'phi2_dv') grabOffset.phi2_dv = 0;

          ev.preventDefault(); 
          ev.stopPropagation();
          canvas.setPointerCapture(ev.pointerId);
          lastX = ev.clientX; 
          lastY = ev.clientY;
          return;
        }
// --- DETECCIÓN UNIVERSAL DE CLIC EN VARAS (Modo Edición) ---
        if (!hit && state.activeLayers.includes('guiado_ortogonal')) {
          const { worldX, worldY } = eventToWorld(ev, canvas);
          const pMouse = { x: worldX, y: worldY };
          const { a, b } = state;
          const R = (a + b) / 2, s = (a - b) / 2;
          const fGiro = Math.max(0, Math.min(1, (state.t - 0.25) / 0.75));
          const th = fGiro * 2 * Math.PI, CT = Math.cos(th), ST = Math.sin(th);

          // Puntos exactos
          const O = { x: 0, y: 0 }, M = { x: R * CT, y: R * ST };
          const H = { x: 2 * R * CT, y: 0 }, V = { x: 2 * M.x - H.x, y: 2 * M.y - H.y };
          const E = { x: H.x + (M.x - H.x) * (b / R), y: H.y + (M.y - H.y) * (b / R) };
          const P = { x: b * CT, y: b * ST }, Vp = { x: 0, y: -(a - b) * ST };
          const xG = a * CT;
          const N = (Math.abs(CT) > 1e-9) ? { x: xG, y: (xG / CT) * ST } : null;
          
          const ux4 = Math.cos(-th), uy4 = -Math.sin(-th);
          const Rpt = { x: s * Math.cos(-th), y: s * Math.sin(-th) };
          const Hpr = { x: Rpt.x + s * ux4, y: Rpt.y + s * uy4 };
          const endVS4 = { x: Rpt.x + R * ux4, y: Rpt.y + R * uy4 };

          const tol = 20 / (viewport.scale * viewport.userZoom); 

          // LISTA DE SEGMENTOS (Detección de varas de colores)
          const segments = [
            { p1: H, p2: E, id: 'HE' }, { p1: E, p2: M, id: 'EM' }, { p1: M, p2: V, id: 'MV' },
            { p1: O, p2: P, id: 'OP' }, { p1: P, p2: M, id: 'PM' },
            { p1: Rpt, p2: Vp, id: 'RVp' }, { p1: O, p2: Rpt, id: 'OR' },
            { p1: Rpt, p2: Hpr, id: 'RHpr' }, { p1: Hpr, p2: endVS4, id: 'HprE' }
          ];
          if (N) segments.push({ p1: M, p2: N, id: 'MN' });

          for (const seg of segments) {
            if (distToSegment(pMouse, seg.p1, seg.p2) < tol) {
              state[`_hide_${seg.id}`] = !state[`_hide_${seg.id}`];
              if(G.syncPanel) G.syncPanel(); 
              ev.preventDefault(); ev.stopPropagation();
              return; 
            }
          }

          // --- DETECCIÓN DE RUEDA (a-b)/2 ---
          const dRueda = Math.hypot(pMouse.x, pMouse.y);
          const rRueda = Math.abs(state.a - state.b) / 2;
          const ruedaTol = 25 / (viewport.scale * viewport.userZoom);

          if (Math.abs(dRueda - rRueda) < ruedaTol) {
              state._hide_rueda_OR = !state._hide_rueda_OR;
              if (G.syncPanel) G.syncPanel();
              if (G._redraw) G._redraw();
              ev.preventDefault(); ev.stopPropagation();
              return; 
          }

          // --- GUÍAS MÓVILES ---
          if (distToSegment(pMouse, {x:-2000, y:E.y}, {x:2000, y:E.y}) < tol || 
              distToSegment(pMouse, {x:xG, y:-2000}, {x:xG, y:2000}) < tol) { 
              state._hide_gv_mob = !state._hide_gv_mob; 
              state._hide_gh_mob = !state._hide_gh_mob;
              if (G.syncPanel) G.syncPanel();
              if (G._redraw) G._redraw();
              ev.preventDefault(); ev.stopPropagation();
              return; 
          }

          // --- EJES FIJOS ---
          if (distToSegment(pMouse, {x:-2*R, y:0}, {x:2*R, y:0}) < tol) { 
              state._hide_gh_fix = !state._hide_gh_fix; 
              if (G.syncPanel) G.syncPanel();
              if (G._redraw) G._redraw();
              ev.preventDefault(); ev.stopPropagation();
              return; 
          }
          if (distToSegment(pMouse, {x:0, y:-2*R}, {x:0, y:2*R}) < tol) { 
              state._hide_gv_fix = !state._hide_gv_fix; 
              if (G.syncPanel) G.syncPanel();
              if (G._redraw) G._redraw();
              ev.preventDefault(); ev.stopPropagation();
              return; 
          }
        } // <--- Este cierra el bloque "if (!hit && state.activeLayers.includes('guiado_ortogonal'))"

        if(ev.button===0){
          dragTarget='pan';
          ev.preventDefault(); ev.stopPropagation();
          canvas.setPointerCapture(ev.pointerId);
          lastX=ev.clientX; lastY=ev.clientY;
        } else { dragTarget=null; }
      });

      canvas.addEventListener('pointermove',(ev)=>{
  if (!dragTarget) {
          // Calcular coordenadas CSS y mundo en este ámbito
          const rect2 = canvas.getBoundingClientRect();
          const mxCSS = ev.clientX - rect2.left;
          const myCSS = ev.clientY - rect2.top;
          const mx2 = mxCSS * (canvas.width / rect2.width) / (viewport.dpr || 1);
          const my2 = myCSS * (canvas.height / rect2.height) / (viewport.dpr || 1);

          let isHover = hitTestHandles(mx2, my2);

          // --- SELECTOR DE MODOS ESPECIALES ---
          if (!isHover) {
            // 1. MODOS DELAUNAY (Ruedas manivela)
            if (state.activeLayers.includes('delaunay_horiz')) {
              const px = viewport.toCSSX(0);
              const py = viewport.toCSSY(state.delaunay_arr_oy || 0);
              if (Math.hypot(mxCSS - px, myCSS - py) < 40 * (viewport.dpr || 1)) isHover = true;
            } 
            else if (state.activeLayers.includes('delaunay_vert')) {
              const px = viewport.toCSSX(state.delaunay_vert_arr_ox || 0);
              const py = viewport.toCSSY(0);
              if (Math.hypot(mxCSS - px, myCSS - py) < 40 * (viewport.dpr || 1)) isHover = true;
            }
            // 2. MODOS DE HEXÁGONO (Steiner, Brianchon, Pascal)
            else if (['steiner_circunelipse','steiner_inelipse','brianchon','pascal'].some(m => state.activeLayers.includes(m))) {
              const hexModes = ['steiner_circunelipse', 'steiner_inelipse', 'brianchon', 'pascal'];
              const activeHexMode = hexModes.find(m => state.activeLayers.includes(m));
              const angles = state._pbAngles || [0,1,2,3,4,5].map(i => (i / 6) * (Math.PI * 2) + 0.3);
              const baseTol = (activeHexMode === 'brianchon' || activeHexMode === 'pascal') ? 18 : 22;
              const tolHex = baseTol * (viewport.dpr || 1);
              for (let i = 0; i < angles.length; i++) {
                const px = viewport.toCSSX(state.a * Math.cos(angles[i]));
                const py = viewport.toCSSY(state.b * Math.sin(angles[i]));
                if (Math.hypot(mxCSS - px, myCSS - py) < tolHex) { isHover = true; break; }
              }
            }
            // 3. GUIADO ORTOGONAL: botón, varas, guías, rueda
            else if (state.activeLayers.includes('guiado_ortogonal') && state.t >= 0.25) {
              // Botón "Ver ocultos"
              const btnW = 140, btnH = 30, btnX = 10, btnY = rect2.height - 40;
              if (mxCSS >= btnX && mxCSS <= btnX + btnW && myCSS >= btnY && myCSS <= btnY + btnH) {
                isHover = true;
              }
              if (!isHover) {
                const { a, b } = state;
                const R = (a + b) / 2, s2 = (a - b) / 2;
                const fGiro2 = Math.max(0, Math.min(1, (state.t - 0.25) / 0.75));
                const th2 = fGiro2 * 2 * Math.PI, CT2 = Math.cos(th2), ST2 = Math.sin(th2);
                const O2 = {x:0,y:0}, M2 = {x:R*CT2, y:R*ST2};
                const H2 = {x:2*R*CT2, y:0};
                const E2 = {x:H2.x+(M2.x-H2.x)*(b/R), y:H2.y+(M2.y-H2.y)*(b/R)};
                const P2 = {x:b*CT2, y:b*ST2}, Vp2 = {x:0, y:-(a-b)*ST2};
                const V2 = {x:2*M2.x-H2.x, y:2*M2.y-H2.y};
                const xG2 = a*CT2;
                const N2 = (Math.abs(CT2)>1e-9) ? {x:xG2, y:(xG2/CT2)*ST2} : null;
                const ux4 = Math.cos(-th2), uy4 = -Math.sin(-th2);
                const Rpt2 = {x:s2*Math.cos(-th2), y:s2*Math.sin(-th2)};
                const Hpr2 = {x:Rpt2.x+s2*ux4, y:Rpt2.y+s2*uy4};
                const endVS42 = {x:Rpt2.x+R*ux4, y:Rpt2.y+R*uy4};
                const tol2 = 20 / (viewport.scale * viewport.userZoom);
                const pW2 = { x: viewport.toWorldX(mxCSS), y: viewport.toWorldY(myCSS) };

                const segs2 = [
                  {p1:H2,p2:E2},{p1:E2,p2:M2},{p1:M2,p2:V2},
                  {p1:O2,p2:P2},{p1:P2,p2:M2},
                  {p1:Rpt2,p2:Vp2},{p1:O2,p2:Rpt2},
                  {p1:Rpt2,p2:Hpr2},{p1:Hpr2,p2:endVS42}
                ];
                if (N2) segs2.push({p1:M2,p2:N2});

                for (const seg of segs2) {
                  if (distToSegment(pW2, seg.p1, seg.p2) < tol2) { isHover = true; break; }
                }

                // Rueda
                if (!isHover) {
                  const dRueda2 = Math.hypot(pW2.x, pW2.y);
                  const rRueda2 = Math.abs(a - b) / 2;
                  if (Math.abs(dRueda2 - rRueda2) < 25 / (viewport.scale * viewport.userZoom)) isHover = true;
                }

                // Guías móviles y fijas
                if (!isHover) {
                  const tolG2 = 20 / (viewport.scale * viewport.userZoom);
                  if (distToSegment(pW2, {x:-2000,y:E2.y}, {x:2000,y:E2.y}) < tolG2) isHover = true;
                  if (!isHover && distToSegment(pW2, {x:xG2,y:-2000}, {x:xG2,y:2000}) < tolG2) isHover = true;
                  if (!isHover && distToSegment(pW2, {x:-2*R,y:0}, {x:2*R,y:0}) < tolG2) isHover = true;
                  if (!isHover && distToSegment(pW2, {x:0,y:-2*R}, {x:0,y:2*R}) < tolG2) isHover = true;
                }
              }
            }
          }

          if (isHover) {
            canvas.style.cursor = 'pointer';
          } else {
            canvas.style.cursor = 'crosshair';
          }
        }
        // ---------------------------------
        if(!dragTarget) return;
        if(activeTouches.size===2) return;
        
        if(dragTarget==='pan'){
          if((ev.buttons&1)===0) return;
          const s=viewport.scale*viewport.userZoom;
          viewport.userPanX+=(ev.clientX-lastX)/s;
          viewport.userPanY-=(ev.clientY-lastY)/s; // Y mundo ↑
          lastX=ev.clientX; lastY=ev.clientY;
          G._redraw?.(); return;
        }

        ev.preventDefault(); ev.stopPropagation();
        const {worldX,worldY}=eventToWorld(ev,canvas);
        const offW=25/(viewport.scale*viewport.userZoom);

        if(dragTarget==='a') {
          const ps = document.getElementById('propSelect');
          if(ps) ps.value = 'free';
          const desiredA = worldX - offW - grabOffset.a;

          if (state.activeLayers.includes('guiado_ortogonal')) {
            // 1. Mantenemos b fija (la altura actual de la elipse)
            const bFixed = state.b; 
            const aNew = Math.max(bFixed + 1, Math.min(A_MAX, desiredA));

            // 2. RECONFIGURACIÓN LÓGICA:
            // Para que b no cambie mientras a se estira, recalculamos R y lambda:
            // R es la media aritmética de los semiejes
            const Rnew = (aNew + bFixed) / 2;
            // lambda es la proporción b/R
            const lamNew = bFixed / Rnew;

            // 3. Aplicamos los nuevos valores al estado
            state._vs0_Rfix = Rnew;
            state._vs0_lambda = lamNew;
            state.a = aNew;
            state.b = bFixed; // Forzamos que b se quede donde estaba

            G.syncPanel();
            return; 
          } else {
            // Comportamiento para el resto de modos
            state.a = Math.max(B_FIXED, Math.min(A_MAX, desiredA));
          }

        } else if(dragTarget==='skew') {
          // 1. Calculamos la posición que pide el ratón
          let newSkew = worldX - state.a - offW - grabOffset.skew;
          
          // 2. EFECTO IMÁN: Si está cerca de 0, lo bloqueamos en 0
          // Usamos una tolerancia de 12 píxeles de pantalla (ajustable)
          const snapLimit = 12 / (viewport.scale * viewport.userZoom);
          if (Math.abs(newSkew) < snapLimit) {
              newSkew = 0;
          }
          
          state.skewX = newSkew;

        } else if(dragTarget==='phi') {
          state.phi = Math.atan2(worldY, worldX);
          state._hipoPhi1Dragged = true;

        } else if(dragTarget==='phi2') {
          state.phi2 = Math.atan2(worldY, worldX);
          state._hipoPhi2Dragged = true;

          } else if(dragTarget==='phi_hipo') {
          state.phi_hipo = Math.atan2(worldY, worldX);
          state._hipoPhi1Dragged = true;

        } else if(dragTarget==='phi2_hipo') {
          state.phi2_hipo = Math.atan2(worldY, worldX);
          state._hipoPhi2Dragged = true;

          
        } else if(dragTarget==='phi_dv') {
          state.phi_dv = Math.atan2(worldY, worldX);
          state._dvPhi1Dragged = true;

        } else if(dragTarget==='phi2_dv') {
          state.phi2_dv = Math.atan2(worldY, worldX);
          state._dvPhi2Dragged = true;
        } else if (dragTarget === 'normalTracer') {
          const fGiroN = Math.max(0, Math.min(1, (state.t - 0.25) / 0.75));
          const thN = fGiroN * Math.PI * 2;
          const aN = state.a, bN = state.b;
          const PxN = aN * Math.cos(thN), PyN = bN * Math.sin(thN);
          const nxR = bN * Math.cos(thN), nyR = aN * Math.sin(thN);
          const nD = Math.sqrt(nxR*nxR + nyR*nyR);
          if (nD > 1e-9) {
            const uxN = nxR/nD, uyN = nyR/nD;
            // Proyectar worldX/Y sobre la dirección normal en P
            let off = (worldX - PxN) * uxN + (worldY - PyN) * uyN;
            // Snap a los dos radios de curvatura críticos (en unidades de mundo)
            // ρ_min = b²/a  (vértice semieje mayor) → offset interior negativo
            // ρ_max = a²/b  (vértice semieje menor) → offset interior negativo
            const snapTol = 12 / (viewport.scale * viewport.userZoom);
            const snapPoints = [-(bN*bN)/aN, -(aN*aN)/bN, (bN*bN)/aN, (aN*aN)/bN];
            for (const sp of snapPoints) {
              if (Math.abs(off - sp) < snapTol) { off = sp; break; }
            }
            state.offsetNormal = off;
          }
          G._redraw?.();
          return;
        } else if (dragTarget === 'vs0_tracer') {
          if (state._vs0_Rfix == null) state._vs0_Rfix = (state.a + state.b) / 2;
          const R = state._vs0_Rfix;
          const fGiro = Math.max(0, Math.min(1, (state.t - 0.25) / 0.75));
          const th = fGiro * Math.PI * 2;
          const M = { x: R * Math.cos(th), y: R * Math.sin(th) };
          const D = { x: 2 * R * Math.cos(th), y: 0 };

          const ux = M.x - D.x, uy = M.y - D.y;
          const L2 = ux*ux + uy*uy || 1e-12;
          let s = ((worldX - D.x) * ux + (worldY - D.y) * uy) / L2;
          s = Math.max(LAMBDA_MIN, Math.min(1, s));

          state._vs0_lambda = s;
          state.a = (2 - s) * R;
          state.b = (s) * R;
          G.syncPanel();
          return;
        }
        G.syncPanel();
      });

      canvas.addEventListener('pointerup',(ev)=>{
        dragTarget=null;
        state._dragTarget = null;
        if(canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
      });

      canvas.addEventListener('wheel',(e)=>{
        e.preventDefault();
        const rect=canvas.getBoundingClientRect();
        const mx=e.clientX-rect.left, my=e.clientY-rect.top;
        const before_gx=viewport.toWorldX(mx), before_gy=viewport.toWorldY(my);
        const delta=e.deltaY>0?0.9:1.1;
        viewport.userZoom=Math.min(Math.max(0.1,viewport.userZoom*delta),100);
        const after_gx=viewport.toWorldX(mx), after_gy=viewport.toWorldY(my);
        viewport.userPanX+=(after_gx-before_gx);
        viewport.userPanY+=(after_gy-before_gy);
        G._redraw?.();
      },{passive:false});

      // --- Táctil / lápiz ---
      (()=>{
        function isTouchOrPen(ev){ return ev.pointerType==='touch'||ev.pointerType==='pen'; }
        function updateTouch(ev,add=true){
          const rect=canvas.getBoundingClientRect();
          const x=ev.clientX-rect.left, y=ev.clientY-rect.top;
          if(add) activeTouches.set(ev.pointerId,{x,y}); else activeTouches.delete(ev.pointerId);
        }
        function twoTouchInfo(){
          if(activeTouches.size!==2) return null;
          const pts=Array.from(activeTouches.values());
          const [p0,p1]=pts;
          return { dist:Math.hypot(p1.x-p0.x, p1.y-p0.y), cx:(p0.x+p1.x)/2, cy:(p0.y+p1.y)/2 };
        }
        canvas.addEventListener('pointerdown',(ev)=>{
          if(!isTouchOrPen(ev)) return;
          updateTouch(ev,true);
          if(activeTouches.size===2){
            const info=twoTouchInfo();
            if(info){
              pinchBaseline={ dist:info.dist, gx:viewport.toWorldX(info.cx), gy:viewport.toWorldY(info.cy) };
              dragTarget=null;
            }
          }
        },{passive:true});
        canvas.addEventListener('pointermove',(ev)=>{
          if(!isTouchOrPen(ev)) return;
          updateTouch(ev,true);
          if(activeTouches.size===2){
            const info=twoTouchInfo();
            if(info&&pinchBaseline&&info.dist>0&&pinchBaseline.dist>0){
              const factor=info.dist/pinchBaseline.dist;
              viewport.userZoom=Math.min(Math.max(0.1,viewport.userZoom*factor),100);
              const after_gx=viewport.toWorldX(info.cx), after_gy=viewport.toWorldY(info.cy);
              viewport.userPanX+=(after_gx-pinchBaseline.gx);
              viewport.userPanY+=(after_gy-pinchBaseline.gy);
              G._redraw?.();
            }
            return;
          }
        },{passive:true});
        canvas.addEventListener('pointerup',(ev)=>{ if(!isTouchOrPen(ev)) return; updateTouch(ev,false); if(activeTouches.size<2) pinchBaseline=null; },{passive:true});
        canvas.addEventListener('pointercancel',(ev)=>{ if(!isTouchOrPen(ev)) return; updateTouch(ev,false); pinchBaseline=null; },{passive:true});
      })();

      return { redraw };
    },

    setMode:(id)=>{ state.activeLayers=[id]; state.mode=id; if(id==='hipotrocoide2') state.phi2=-state.phi; G._redraw?.(); },
    toggleLayer:(id)=>{
      const idx=state.activeLayers.indexOf(id);
      if(idx>-1) state.activeLayers.splice(idx,1); else { state.activeLayers.push(id); if(id==='hipotrocoide2') state.phi2=-state.phi; }
      G._redraw?.();
    },
    syncPanel:()=>{
      enforceEccentricityLimit('auto'); // coherencia global
      window.dispatchEvent(new CustomEvent('elipse-cambiada')); G._redraw?.();
    }
  });

  // ===== Atajos de teclado =====
  window.addEventListener('keydown',(e)=>{
    const vp=ElipseLab.viewport;
    const step=30/(vp.scale*vp.userZoom);
    if(e.key==='ArrowLeft')  { vp.userPanX+=step;  ElipseLab._redraw?.(); }
    if(e.key==='ArrowRight') { vp.userPanX-=step;  ElipseLab._redraw?.(); }
    if(e.key==='ArrowUp')    { vp.userPanY+=step;  ElipseLab._redraw?.(); }
    if(e.key==='ArrowDown')  { vp.userPanY-=step;  ElipseLab._redraw?.(); }
    if(e.key==='+'||e.key==='=') { vp.userZoom=Math.min(15,vp.userZoom*1.1); ElipseLab._redraw?.(); }
    if(e.key==='-'||e.key==='_') { vp.userZoom=Math.max(0.1,vp.userZoom*0.9); ElipseLab._redraw?.(); }

    if(e.key&&e.key.toLowerCase&&e.key.toLowerCase()==='r'){
      vp.userPanX=0; vp.userPanY=0; vp.userZoom=1;
      ElipseLab.state.a=150; ElipseLab.state.b=100; ElipseLab.state.skewX=0;
      ElipseLab.state.phi=Math.PI/6; ElipseLab.state.phi2=(ElipseLab.state.mode==='hipotrocoide2') ? -Math.PI/6 : Math.PI/6+Math.PI/3;

      // Guiado ortogonal. reset específico
      ElipseLab.state._vs0_Rfix = null;
      ElipseLab.state._vs0_lambda = null;

      enforceEccentricityLimit('auto');
      vp.resetScale?.(); ElipseLab.syncPanel();
    }

    // Tecla 'H' para mostrar/ocultar elementos "fantasma"
    if(e.key && e.key.toLowerCase() === 'h'){
      state.showHidden = !state.showHidden;
      ElipseLab._redraw?.();
    }

  });

})();
