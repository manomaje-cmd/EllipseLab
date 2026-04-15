(function () {
  if (!window.ElipseLab) return;

  ElipseLab.registerMode('dandelin', (ctx, state, H) => {
    const { viewport: vp, getColors, params, drawSegment, drawPoint, drawLabel, drawAxesExact } = H;
    const col  = getColors();
    let { a, b, c } = params();
    const dpr  = vp.dpr || 1;

    // Colores UI
    const C_CONO   = "#222";
    const C_EJE    = "#aaa";
    const C_PLANO  = col.ellipse;
    const C_ESF1   = "#1a7a1a";
    const C_ESF2   = "#0055aa";
    const C_CIAN   = "rgba(0,80,180,0.4)";
    const C_DIR    = "#888";

    // Paleta gris "tipo cono"
    const C_TRI_DARK  = "rgba(40, 40, 40, 0.55)";
    const C_TRI_MID   = "rgba(220,220,220,0.18)";
    const C_TRI_HL0   = "rgba(255,255,255,0.16)";
    const C_TRI_HL1   = "rgba(255,255,255,0.06)";
    const C_TRI_AO    = "rgba(0,0,0,0.12)";
    const C_TRI_FILL  = "rgba(60,60,60,0.32)";

    const ALFA    = 20 * Math.PI / 180;
    const ROT_MAX = 65 * Math.PI / 180;

    // ——— Ratio e(ángulo) → límite geométrico (original)
    function computeRatio(rotAng) {
      const sinR=Math.sin(rotAng), cosR=Math.cos(rotAng);
      const angIzq=rotAng-ALFA, angDer=rotAng+ALFA;
      if (angDer >= Math.PI/2-1e-6) return 1.0;
      const Vry=cosR, Vrx=-sinR;
      const tI=Vry/Math.cos(angIzq), tD=Vry/Math.cos(angDer);
      const P1rx=Vrx+tI*Math.sin(angIzq), P2rx=Vrx+tD*Math.sin(angDer);
      const midX=(P1rx+P2rx)/2;
      const V={x:Vrx-midX,y:Vry}, P1={x:P1rx-midX,y:0}, P2={x:P2rx-midX,y:0};
      const dst=(A,B)=>Math.hypot(A.x-B.x,A.y-B.y);
      const d12=dst(P1,P2), dV1=dst(V,P1), dV2=dst(V,P2), per=d12+dV1+dV2;
      const Ix=(d12*V.x+dV2*P1.x+dV1*P2.x)/per;
      return Math.abs(Ix)/((P2.x-P1.x)/2);
    }

    // ——— Geometría del modo (idéntica al original)
    const E_MAX_CONO = computeRatio(ROT_MAX * 0.9999);
    const e_raw = a > 1e-9 ? c / a : 0;
    const e = Math.min(e_raw, E_MAX_CONO);
    if (e < e_raw) { a = b/Math.sqrt(1-e*e); c = Math.sqrt(Math.max(0,a*a-b*b)); }

    let lo=0, hi=ROT_MAX*0.9999;
    for (let i=0; i<60; i++) { const m=(lo+hi)/2; if(computeRatio(m)<e) lo=m; else hi=m; }
    const rotAng=(lo+hi)/2;
    const sinR=Math.sin(rotAng), cosR=Math.cos(rotAng);

    const sinA=Math.sin(ALFA), sin2A=Math.sin(2*ALFA);
    let denom=cosR*cosR-sinA*sinA; if(denom<1e-4) denom=1e-4;
    const H_CONE=(2*a)*denom/(Math.max(0.1,cosR)*sin2A);

    const angGenIzq=rotAng-ALFA, angGenDer=rotAng+ALFA;
    const Vry=H_CONE*cosR, Vrx=-H_CONE*sinR;
    const tIzq=Vry/Math.cos(angGenIzq), tDer=Vry/Math.cos(angGenDer);
    const P1rx=Vrx+tIzq*Math.sin(angGenIzq), P2rx=Vrx+tDer*Math.sin(angGenDer);
    const midX=(P1rx+P2rx)/2;
    const V={x:Vrx-midX,y:Vry}, P1={x:P1rx-midX,y:0}, P2={x:P2rx-midX,y:0};

    function projOnGen(centro,dir){
      const t=(centro.x-V.x)*dir.x+(centro.y-V.y)*dir.y;
      return {x:V.x+t*dir.x,y:V.y+t*dir.y};
    }

    const dst=(A,B)=>Math.hypot(A.x-B.x,A.y-B.y);
    const d12=dst(P1,P2), dV1=dst(V,P1), dV2=dst(V,P2), per=d12+dV1+dV2;
    const I={x:(d12*V.x+dV2*P1.x+dV1*P2.x)/per, y:(d12*V.y+dV2*P1.y+dV1*P2.y)/per};
    const r1=(Math.abs(V.x*(P1.y-P2.y)+P1.x*(P2.y-V.y)+P2.x*(V.y-P1.y))/2)/(per/2);
    const f1={x:I.x, y:0};

    const dirEje={x:sinR,y:-cosR};
    const angP1I=Math.atan2(I.y-P1.y,I.x-P1.x);
    const perpDir={x:Math.cos(angP1I+Math.PI/2),y:Math.sin(angP1I+Math.PI/2)};
    const det=dirEje.x*(-perpDir.y)-dirEje.y*(-perpDir.x);
    let C2=null, r2=0;
    if (Math.abs(det)>1e-6) {
      const tp=((P1.x-V.x)*(-perpDir.y)-(P1.y-V.y)*(-perpDir.x))/det;
      const cand={x:V.x+tp*dirEje.x,y:V.y+tp*dirEje.y};
      if (cand.y<0) { C2=cand; r2=Math.abs(C2.y); }
    }
    const f2=C2?{x:C2.x,y:0}:null;

    const dirIzq={x:Math.sin(angGenIzq),y:-Math.cos(angGenIzq)};
    const dirDer={x:Math.sin(angGenDer),y:-Math.cos(angGenDer)};
    const Tang1_izq=projOnGen(I,dirIzq);
    const Tang1_der=projOnGen(I,dirDer);
    const Tang2_izq=C2?projOnGen(C2,dirIzq):null;
    const Tang2_der=C2?projOnGen(C2,dirDer):null;
    const eIzq = Tang2_izq ?? P1;
    const eDer  = Tang2_der ?? P2;

    const intersectY0=(A,B)=>{
      const dy=B.y-A.y; if(Math.abs(dy)<1e-9) return null;
      const t=-A.y/dy; return {x:A.x+t*(B.x-A.x),y:0};
    };
    const Dir1=intersectY0(Tang1_izq,Tang1_der);
    const Dir2=C2?intersectY0(Tang2_izq,Tang2_der):null;

    const ejeTop={x:V.x-H_CONE*0.2*sinR, y:V.y+H_CONE*0.2*cosR};
    const ejeBot=C2 ? C2 : {x:V.x+H_CONE*1.8*sinR, y:V.y-H_CONE*1.8*cosR};

    // ──────────────────────────────────────────────────────────────
    //  ALZADO — OFFSET + SEPARACIÓN DINÁMICA (px) usando TRI ROTADO
    // ──────────────────────────────────────────────────────────────
    // Usamos 6.5 * b como margen de seguridad para que no solape con la planta
    const GAP = 6.5* b; 
    
    // El 'suelo' del alzado es ahora siempre el plano de la elipse (y=0)
    const alzadoOfsY = b + GAP; 
    
    window.ElipseLab.state._dandelinAlzadoY = alzadoOfsY;

    const vpA = new Proxy(vp, {
      get(target, prop) {
        if (prop==='Y') return (y) => target.Y(y + alzadoOfsY);
        return typeof target[prop]==='function' ? target[prop].bind(target) : target[prop];
      }
    });

    // ——— Helpers locales
    const seg=(A,B,color,w2=1,alpha=1,vpX=vp)=>drawSegment(ctx,A,B,color,w2*dpr,alpha,vpX);
    const pt=(x,y,color,r=3,outline=false,alpha=1,vpX=vp)=>drawPoint(ctx,x,y,color,r*dpr,outline,alpha,vpX);
    const lbl=(x,y,text,opts={},vpX=vp)=>drawLabel(ctx,vpX.X(x),vpX.Y(y),text,{size:12,color:"#222",...opts},vpX);

    // ——— PLANTA
    if (state.showAxes && typeof drawAxesExact==='function') {
      drawAxesExact(ctx,a,b,vp);
    } else {
      H.drawHandle(ctx,a,0,"#ff0000",'h',1,vp);
    }
    H.drawEllipse(ctx,a,b,col.ellipse,col.strokeGrueso,vp);
    H.drawFoci(ctx,a,b,vp);

    if (Dir1 && Dir2) {
      [Dir1,Dir2].forEach((D,i)=>{
        const yExt=b*1.35;
        ctx.save();
        ctx.strokeStyle=C_DIR; ctx.lineWidth=1*dpr;
        ctx.setLineDash([5*dpr,4*dpr]);
        ctx.beginPath();
        ctx.moveTo(vp.X(D.x),vp.Y(-yExt));
        ctx.lineTo(vp.X(D.x),vp.Y( yExt));
        ctx.stroke();
        ctx.restore();
        lbl(D.x+0.02*a,yExt*0.82,i===0?"d₁":"d₂",{color:C_DIR,size:11});
      });
    }


    // ——— ALZADO: eje
    ctx.save();
    ctx.strokeStyle=C_EJE; ctx.lineWidth=1*dpr; ctx.globalAlpha=0.6;
    ctx.setLineDash([8*dpr,4*dpr,2*dpr,4*dpr]);
    ctx.beginPath();
    ctx.moveTo(vpA.X(ejeTop.x),vpA.Y(ejeTop.y));
    ctx.lineTo(vpA.X(ejeBot.x),vpA.Y(ejeBot.y));
    ctx.stroke();
    ctx.restore();

    // ——— TRIÁNGULO “CONO”: persistente (mundo) + rotación (bisectriz) + sombreado gris
{
  const LS_KEY_W   = "elab_dandelin_redTriW";
  const CACHE_VER  = "dandelin:v1"; // ← sube este texto cuando cambies ALFA/ROT_MAX o la lógica
  const EPS_MAX    = 1e-5;
  const EPS_ANG    = 1e-4;
  const ANG_LIM    = ROT_MAX * 0.999;

  function loadTriMaxW() {
    try {
      const s = localStorage.getItem(LS_KEY_W);
      if (!s) return null;
      const o = JSON.parse(s);
      if (!o || !o.ver) return null;                 // sin versión ⇒ inválido
      if (o.ver !== CACHE_VER) return null;          // versión distinta ⇒ inválido
      if (o.B > 0 && o.H > 0) return { B:o.B, H:o.H, locked:true };
    } catch(_) {}
    return null;
  }

  function saveTriMaxW(B,H) {
    try { localStorage.setItem(LS_KEY_W, JSON.stringify({ ver:CACHE_VER, B, H })); } catch(_){}
  }

  function clearTriMaxW() {
    try { localStorage.removeItem(LS_KEY_W); } catch(_){}
  }

  // Inicializar caché en estado (una vez)
  if (state._redTriMaxW === undefined) {
    state._redTriMaxW = loadTriMaxW();
    if (!state._clearRedTriMaxW) {
      state._clearRedTriMaxW = () => {
        state._redTriMaxW = null;
        clearTriMaxW();
        window.ElipseLab?._redraw?.();
      };
    }
    // Opción: reset "duro" desde la URL ?coneReset=1 (útil para webview)
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get("coneReset") === "1") state._clearRedTriMaxW();
    } catch(_) {}
  }

  // ¿Estamos en e_max o ángulo máximo?
  const e_raw_here = (a > 1e-9 ? c / a : 0);
  const atMaxE   = (e >= E_MAX_CONO - EPS_MAX) || (e_raw_here >= E_MAX_CONO - EPS_MAX);
  const atMaxAng = (rotAng >= ANG_LIM - EPS_ANG);

  // Cálculo instantáneo del triángulo en unidades de mundo
  const dx = eDer.x - eIzq.x, dy = eDer.y - eIzq.y;
  const Bw = Math.hypot(dx,dy);
  const Hw = (Bw > 0) ? Math.abs(dx*(V.y - eIzq.y) - dy*(V.x - eIzq.x))/Bw : 0;

  // Política de captura/recaptura:
  //  - Si no hay caché válida y estamos en máximo ⇒ capturamos.
  //  - Si hay caché pero difiere de lo que toca en máximo ⇒ recapturamos (ignora locked).
  const needCapture =
    (atMaxE || atMaxAng)
    && (
         !state._redTriMaxW
      || !state._redTriMaxW.B
      || !state._redTriMaxW.H
      || Math.abs(Bw - state._redTriMaxW.B) > 1e-3
      || Math.abs(Hw - state._redTriMaxW.H) > 1e-3
    );

  if (needCapture && Bw > 0 && Hw > 0) {
    state._redTriMaxW = { B: Bw, H: Hw, locked: true };
    saveTriMaxW(Bw, Hw);
  }

  const tri = state._redTriMaxW || ((Bw > 0 && Hw > 0) ? { B: Bw, H: Hw, locked: false } : null);
  if (tri && tri.B > 0 && tri.H > 0) {
    const B = tri.B, Hh = tri.H;

    // Rotación por bisectriz
    const angR = Math.atan2(eDer.y - V.y, eDer.x - V.x);
    const angL = Math.atan2(eIzq.y - V.y, eIzq.x - V.x);
    const bisCone = (angR + angL) / 2;
    const bisTriLocal = Math.atan2(-Hh, 0);
    const theta = bisCone - bisTriLocal;

    const ct=Math.cos(theta), st=Math.sin(theta);
    const rot = (x,y)=>({x:x*ct - y*st, y:x*st + y*ct});

    const apex = {x:V.x, y:V.y};
    const Lloc = rot(-B/2, -Hh);
    const Rloc = rot(+B/2, -Hh);
    const L = { x: apex.x + Lloc.x, y: apex.y + Lloc.y };
    const R = { x: apex.x + Rloc.x, y: apex.y + Rloc.y };

    // A pantalla
    const pV = { x: vpA.X(apex.x), y: vpA.Y(apex.y) };
    const pL = { x: vpA.X(L.x),    y: vpA.Y(L.y)    };
    const pR = { x: vpA.X(R.x),    y: vpA.Y(R.y)    };

    const mkPath = () => {
      ctx.beginPath();
      ctx.moveTo(pV.x, pV.y);
      ctx.lineTo(pL.x, pL.y);
      ctx.lineTo(pR.x, pR.y);
      ctx.closePath();
    };

    // (A) Gradiente a lo largo de la base (conoidal)
    const gBase = ctx.createLinearGradient(pL.x,pL.y,pR.x,pR.y);
    gBase.addColorStop(0.00, C_TRI_DARK);
    gBase.addColorStop(0.50, C_TRI_MID);
    gBase.addColorStop(1.00, C_TRI_DARK);
    ctx.save(); mkPath(); ctx.fillStyle = gBase; ctx.fill(); ctx.restore();

    // (B) Highlight radial interior
    ctx.save();
    const midBase = { x:(pL.x+pR.x)/2, y:(pL.y+pR.y)/2 };
    const hx = pV.x + (midBase.x - pV.x)*0.25;
    const hy = pV.y + (midBase.y - pV.y)*0.25;
    const baseLen = Math.hypot(pR.x-pL.x, pR.y-pL.y);
    const rHL = Math.max(12, baseLen*0.22);
    const gHL = ctx.createRadialGradient(hx,hy, rHL*0.12, hx,hy, rHL);
    gHL.addColorStop(0.00, C_TRI_HL0);
    gHL.addColorStop(0.40, C_TRI_HL1);
    gHL.addColorStop(1.00, "rgba(255,255,255,0.00)");
    mkPath();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gHL; ctx.fill();
    ctx.restore();

    // (C) Oclusión tenue en base
    ctx.save();
    const nx = pV.x - midBase.x, ny = pV.y - midBase.y;
    const nlen = Math.hypot(nx,ny)||1;
    const ux = nx/nlen, uy = ny/nlen;
    const gAO = ctx.createLinearGradient(
      midBase.x - ux*2,   midBase.y - uy*2,
      midBase.x + ux*baseLen*0.28, midBase.y + uy*baseLen*0.28
    );
    gAO.addColorStop(0.00, C_TRI_AO);
    gAO.addColorStop(1.00, "rgba(0,0,0,0.00)");
    mkPath();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = gAO; ctx.fill();
    ctx.restore();
  }
}

    // ——— ALZADO: punto V y resto
    pt(V.x,V.y,C_CONO,3,false,1,vpA);
    lbl(V.x-0.06*a,V.y+0.05*b,"V",{color:C_CONO},vpA);

    // Plano de corte
    seg(P1,P2,C_PLANO,2.5,1,vpA);
    pt(P1.x,0,C_PLANO,3,false,1,vpA);
    pt(P2.x,0,C_PLANO,3,false,1,vpA);
    lbl(P1.x-0.09*a,0.07*b,"P₁",{color:C_PLANO},vpA);
    lbl(P2.x+0.03*a,0.07*b,"P₂",{color:C_PLANO},vpA);

    // Directrices y enlaces
    const dash = (A,B,color,w,vpX,pattern)=>{
      const s = vpX || vp;
      ctx.save();
      ctx.strokeStyle=color; ctx.lineWidth=w*dpr;
      ctx.setLineDash(pattern||[3*dpr,3*dpr]);
      ctx.beginPath();
      ctx.moveTo(s.X(A.x),s.Y(A.y));
      ctx.lineTo(s.X(B.x),s.Y(B.y));
      ctx.stroke();
      ctx.restore();
    };
    if (Dir1) dash({x:P1.x,y:0},{x:Dir1.x,y:0},C_DIR,0.8,vpA,[3*dpr,3*dpr]);
    if (Dir2) dash({x:P2.x,y:0},{x:Dir2.x,y:0},C_DIR,0.8,vpA,[3*dpr,3*dpr]);

    const drawLink = (x,color)=>{
      ctx.save();
      ctx.strokeStyle=color; ctx.lineWidth=1*dpr; ctx.setLineDash([3*dpr,3*dpr]);
      ctx.beginPath();
      ctx.moveTo(vp.X(x),vpA.Y(0)); // alzado
      ctx.lineTo(vp.X(x),vp.Y(0));  // planta
      ctx.stroke();
      ctx.restore();
    };
    if (Dir1) drawLink(Dir1.x,C_DIR);
    if (Dir2) drawLink(Dir2.x,C_DIR);
    if (f1) drawLink(f1.x,C_ESF1);
    if (f2) drawLink(f2.x,C_ESF2);

    // Focos en alzado
    if (f1) { pt(f1.x,0,col.foci,3,false,1,vpA); lbl(f1.x,-0.1*b,"F₁'",{color:col.foci,size:11},vpA); }
    if (f2) { pt(f2.x,0,col.foci,3,false,1,vpA); lbl(f2.x,-0.1*b,"F₂'",{color:col.foci,size:11},vpA); }

    // Esfera 1
    {
      const cx=I.x, cy=I.y, r=r1;
      const rpx=r*vp.scale*vp.userZoom;
      if (rpx>1) {
        ctx.save();
        const px=vpA.X(cx), py=vpA.Y(cy);
        const grad=ctx.createRadialGradient(px+rpx*0.4,py+rpx*0.4,rpx*0.05,px,py,rpx*1.0);
        grad.addColorStop(0,'rgba(255,255,255,0.3)');
        grad.addColorStop(0.42,'rgba(20,120,20,0.2)');
        grad.addColorStop(1,'rgba(20,120,20,0.1)');
        ctx.beginPath(); ctx.arc(px,py,rpx,0,Math.PI*2);
        ctx.fillStyle=grad; ctx.fill(); ctx.restore();
      }
      dash(I,P1,C_CIAN,1,vpA);
      dash(I,P2,C_CIAN,1,vpA);
      pt(I.x,I.y,C_ESF1,3,false,1,vpA);
      lbl(I.x+0.04*a,I.y,"I",{color:C_ESF1},vpA);

      seg(Tang1_izq,Tang1_der,C_ESF1,1.5,0.9,vpA);
      if (Dir1) {
        dash(Tang1_izq,Dir1,C_DIR,0.8,vpA);
        dash(Tang1_der,Dir1,C_DIR,0.8,vpA);
        pt(Dir1.x,0,C_DIR,3,true,1,vpA);
      }
    }

    // Esfera 2
    if (C2 && r2>0.5) {
      const cx=C2.x, cy=C2.y, r=r2;
      const rpx=r*vp.scale*vp.userZoom;
      if (rpx>1) {
        ctx.save();
        const px=vpA.X(cx), py=vpA.Y(cy);
        const grad=ctx.createRadialGradient(px+rpx*0.4,py+rpx*0.4,rpx*0.05,px,py,rpx*1.0);
        grad.addColorStop(0,'rgba(255,255,255,0.3)');
        grad.addColorStop(0.42,'rgba(0,80,160,0.2)');
        grad.addColorStop(1,'rgba(0,80,160,0.1)');
        ctx.beginPath(); ctx.arc(px,py,rpx,0,Math.PI*2);
        ctx.fillStyle=grad; ctx.fill(); ctx.restore();
      }

      dash(C2,P1,C_CIAN,1,vpA);
      pt(C2.x,C2.y,C_ESF2,3,false,1,vpA);
      lbl(C2.x+0.04*a,C2.y,"T",{color:C_ESF2},vpA);

      seg(Tang2_izq,Tang2_der,C_ESF2,1.5,0.9,vpA);
      if (Dir2) {
        dash(Tang2_izq,Dir2,C_DIR,0.8,vpA);
        dash(Tang2_der,Dir2,C_DIR,0.8,vpA);
        pt(Dir2.x,0,C_DIR,3,true,1,vpA);
      }
    }
  });
})();