(function() {
    if (!window.ElipseLab) return;

    const G = window.ElipseLab;

    const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
    const mul = (v, s) => ({ x: v.x * s, y: v.y * s });

    function spacingToDivs(val) {
        const minD = 4, maxD = 24;
        const minS = 0.05, maxS = 2.50;
        let d = maxD - ((val - minS) / (maxS - minS)) * (maxD - minD);
        d = Math.round(Math.max(minD, d));
        return d % 2 !== 0 ? d + 1 : d;
    }

    const TAU = Math.PI * 2;
    const AFF_CIRC_COLOR = '#9c9c9c';
    const DIAL_GRAY      = 'rgba(156,163,175,0.35)';

    // ── Ajustes de sombra/halo para el dial ───────────────────────────────
    const DIAL_SHADOW_COLOR = 'rgba(0,0,0,0.35)';
    const DIAL_SHADOW_BLUR  = 16;   // px lógicos; se escalan por dpr
    const DIAL_SHADOW_OFFY  = 2;    // desplazamiento vertical sutil

    const DIAL_HALO_OUTER   = 12;   // alcance del halo hacia fuera (px)
    const DIAL_HALO_ALPHA   = 0.25; // opacidad máxima del halo en el borde

    function deg2rad(d){ return d * Math.PI / 180; }

    function getDialGeomFromCanvas(canvas){
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const m = 16, R = 40, rKnob = 5;
        return { cx: w-(R+m), cy: (R+m), R, rKnob, w, h };
    }

    // ── HUD del dial con sombra difuminada y halo radial ───────────────────
    function drawDialHUD(ctx, vp){
        const dpr = vp.dpr || 1;
        const g = getDialGeomFromCanvas(ctx.canvas);
        G.state._hudGeom = g;

        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // (B) HALO RADIAL exterior (opcional, queda por debajo del disco)
        {
            const R0  = g.R;
            const R1  = g.R + DIAL_HALO_OUTER;
            const grd = ctx.createRadialGradient(g.cx, g.cy, R0*0.98, g.cx, g.cy, R1);

            // Transparente pegado al borde del disco; más opaco hacia fuera
            grd.addColorStop(0.00, 'rgba(0,0,0,0.00)');
            grd.addColorStop(0.35, 'rgba(0,0,0,0.06)');
            grd.addColorStop(0.70, `rgba(0,0,0,${DIAL_HALO_ALPHA*0.6})`);
            grd.addColorStop(1.00, `rgba(0,0,0,${DIAL_HALO_ALPHA})`);

            ctx.beginPath();
            ctx.arc(g.cx, g.cy, R1, 0, TAU);
            ctx.fillStyle = grd;
            ctx.fill();
        }

        // (A) SOMBRA real usando shadowBlur (queda bajo el disco)
        {
            ctx.save();
            ctx.shadowColor   = DIAL_SHADOW_COLOR;
            ctx.shadowBlur    = DIAL_SHADOW_BLUR * dpr; // escalar por dpr
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = DIAL_SHADOW_OFFY * dpr;

            // Relleno fantasma para "depositar" la sombra
            ctx.beginPath();
            ctx.arc(g.cx, g.cy, g.R + 1, 0, TAU);
            ctx.fillStyle = 'rgba(0,0,0,0.001)'; // casi transparente
            ctx.fill();
            ctx.restore();
        }

        // Disco gris del dial
        ctx.beginPath();
        ctx.arc(g.cx, g.cy, g.R, 0, TAU);
        ctx.fillStyle = DIAL_GRAY;
        ctx.fill();

        // Knob
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

    function easeInOut(x){ return x<0.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2; }

    function conjugadosGeom(phi, a, b){
        const D2      = { x: a*Math.cos(phi),           y: b*Math.sin(phi) };
        const minusD2 = { x: -D2.x,                     y: -D2.y };
        const D1      = { x: a*Math.cos(phi+Math.PI/2), y: b*Math.sin(phi+Math.PI/2) };
        const minusD1 = { x: -D1.x,                     y: -D1.y };
        const R       = Math.hypot(D1.x, D1.y);
        const dirX    = -D1.y/(R||1), dirY = D1.x/(R||1);
        const C       = { x: R*dirX, y: R*dirY };
        const minusC  = { x: -C.x,   y: -C.y   };
        return { D1, minusD1, D2, minusD2, C, minusC, R };
    }

    function nearestC(p, C, minusC){
        return Math.hypot(p.x-C.x,p.y-C.y) <= Math.hypot(p.x-minusC.x,p.y-minusC.y)
            ? C : minusC;
    }

    function computeStop(D1, D2){
        const den = Math.sqrt(D1.y*D1.y + D2.y*D2.y);
        if (den < 1e-9) return 0;
        return Math.max(0, Math.min(1, Math.abs(D2.y) / den));
    }

    function labelAt(ctx, wx, wy, text, drawLabel, vp, distPx){
        const len = Math.hypot(wx, wy) || 1;
        const ux = wx/len, uy = wy/len;
        const d = distPx * (vp.dpr||1);
        drawLabel(ctx, vp.X(wx) + ux*d, vp.Y(wy) - uy*d,
                  text, { size: 13, bold: true, color: '#333' }, vp);
    }
    function labelOrigin(ctx, drawLabel, vp){
        drawLabel(ctx, vp.X(0) - 14*(vp.dpr||1), vp.Y(0),
                  'O', { size: 13, bold: true, color: '#333' }, vp);
    }

    G.registerMode('conjugados', (ctx, state, H) => {
        const {
            viewport: vp, getColors, params,
            drawSegment, drawPoint, drawHandle, drawFoci,
            drawEllipse, drawCircleWorld, drawAxesExact,
            drawLabel
        } = H;

        const { a, b } = params();
        const col = getColors();

        if (G.state.thetaHud  == null) G.state.thetaHud   = deg2rad(35);
        if (G.state.thetaSense == null) G.state.thetaSense = +1;

        if (!G.state._hudBound) {
            const canvas = ctx.canvas;
            const onDown = (e) => {
                const r = canvas.getBoundingClientRect();
                const mx = e.clientX-r.left, my = e.clientY-r.top;
                const g = G.state._hudGeom || getDialGeomFromCanvas(canvas);
                if (isInDial(mx,my,g) || isOnKnob(mx,my,G.state.thetaHud||0,g)){
                    e.preventDefault(); e.stopPropagation();
                    try{ canvas.setPointerCapture?.(e.pointerId); }catch{}
                    G.state._dragDial = true;
                    updateAngleFromPointer(e, canvas);
                    canvas.style.cursor = 'grabbing';
                    G._redraw?.();
                }
            };
            const onMove = (e) => {
                if (G.state._dragDial){
                    e.preventDefault(); e.stopPropagation();
                    updateAngleFromPointer(e, canvas);
                    canvas.style.cursor = 'grabbing';
                    G._redraw?.(); return;
                }
                const r = canvas.getBoundingClientRect();
                const mx = e.clientX-r.left, my = e.clientY-r.top;
                const g = G.state._hudGeom || getDialGeomFromCanvas(canvas);
                if (isInDial(mx,my,g)||isOnKnob(mx,my,G.state.thetaHud||0,g)){
                    canvas.style.cursor = 'grab';
                } else if (canvas.style.cursor==='grab'){
                    canvas.style.cursor = '';
                }
            };
            const onUp = (e) => {
                if (G.state._dragDial){
                    e.preventDefault(); e.stopPropagation();
                    G.state._dragDial = false;
                    try{ canvas.releasePointerCapture?.(e.pointerId); }catch{}
                    canvas.style.cursor = '';
                    G._redraw?.();
                }
            };
            canvas.addEventListener('pointerdown',  onDown, {capture:true});
            canvas.addEventListener('pointermove',  onMove, {capture:true});
            canvas.addEventListener('pointerup',    onUp,   {capture:true});
            canvas.addEventListener('pointercancel',onUp,   {capture:true});
            G.state._hudBound = true;
        }

        const t = state.t ?? 1;
        const phiHUD = (-1) * (G.state.thetaSense||1) * (G.state.thetaHud||0);
        const gf = conjugadosGeom(phiHUD, a, b);
        const { D1, minusD1, D2, minusD2, C, minusC, R } = gf;

        const Cn = nearestC(D2, C, minusC);

        function remap01(t, a, b){ return Math.max(0, Math.min(1, (t-a)/(b-a))); }
        function easeOut3(x){ return 1 - Math.pow(1-x, 3); }

        const alphaD1D2  = 1;
        const alphaCirc  = easeOut3(remap01(t, 0.05, 0.10));

        const angD1      = Math.atan2(D1.y, D1.x);
        const angCn      = Math.atan2(Cn.y, Cn.x);
        const giroP = remap01(t, 0.10, 0.18);
        const angStart   = angD1 + Math.PI;
        let   angDiff    = angCn - angStart;
        angDiff = angDiff - Math.PI * 2 * Math.round(angDiff / (Math.PI * 2));
        const angOC      = angStart + angDiff * giroP;
        const OCnow      = { x: R * Math.cos(angOC), y: R * Math.sin(angOC) };
        const alphaOC    = easeOut3(remap01(t, 0.10, 0.13));

        const sStop = computeStop(D1, D2);

        let s, k, P, Cs, D2s, alphaTriang;
        const mCn = { x: -Cn.x, y: -Cn.y };

        // USAMOS EL sStop QUE YA ESTÁ DECLARADO EN LA LÍNEA 168
        const angleStop = Math.asin(sStop); 

        if (t < 0.25) {
            // Fase de entrada: El triángulo crece linealmente hasta sStop
            s   = remap01(t, 0.18, 0.25) * sStop;
            k   = Math.sqrt(Math.max(0, 1 - s*s));
            P   = mul(D1, s);
            Cs  = add(P, mul(Cn,  k));
            D2s = add(P, mul(D2,  k));
            alphaTriang = easeOut3(remap01(t, 0.18, 0.21));

        } else {
            // FASE DE TRAZADO (t >= 0.25)
            // Sincronización total con Excentricidad: ángulo u de 0 a 2*PI
            const u = (t - 0.25) / 0.75 * Math.PI * 2;
            alphaTriang = 1;

            // Determinamos el tramo según el ángulo paramétrico u
            if (u < (Math.PI / 2 - angleStop)) {
                // Tramo 1: s va de sStop a 1
                s = Math.sin(angleStop + u);
                P = mul(D1, s); k = Math.sqrt(Math.max(0, 1 - s*s));
                Cs = add(P, mul(Cn, k)); D2s = add(P, mul(D2, k));
            } 
            else if (u < (1.5 * Math.PI - angleStop)) {
                // Tramos 2 y 3: El semicírculo "largo" por el otro lado
                // s va de 1 a 0 y de 0 a -1
                let u_local = u - (Math.PI / 2 - angleStop);
                s = Math.cos(u_local);
                P = mul(D1, s); k = Math.sqrt(Math.max(0, 1 - s*s));
                Cs = add(P, mul(mCn, k)); D2s = add(P, mul(minusD2, k));
            } 
            else {
                // Tramo 4: s vuelve de -1 a sStop
                let u_local = u - (1.5 * Math.PI - angleStop);
                s = Math.sin(-Math.PI / 2 + u_local);
                P = mul(D1, s); k = Math.sqrt(Math.max(0, 1 - s*s));
                Cs = add(P, mul(Cn, k)); D2s = add(P, mul(D2, k));
            }

            // Desvanecimiento final
            if (t > 0.97) alphaTriang = 1 - easeOut3(remap01(t, 0.97, 1.00));
        }

        const O = { x:0, y:0 };

        if (state.showAxes) drawAxesExact(ctx, a, b, vp);

        if (alphaCirc > 0)
            drawCircleWorld(ctx, 0, 0, R, col.circs, col.strokeFino, 0.3 * alphaCirc, vp);

        if (t >= 0.999) {
            drawEllipse(ctx, a, b, col.ellipse, col.strokeGrueso, vp);
        } else if (t >= 0.25) {
            let phiEnd;
            const phiRaw = Math.atan2(D2s.y / b, D2s.x / a);
            if (t < 0.4375) {
                phiEnd = phiRaw >= 0 ? phiRaw : phiRaw + Math.PI*2;
            } else if (t < 0.625) {
                const phi_D1 = Math.atan2(D1.y / b, D1.x / a);
                phiEnd = phiRaw >= 0 ? phiRaw : phiRaw + Math.PI*2;
                if (phiEnd < phi_D1) phiEnd += Math.PI*2;
            } else if (t < 0.8125) {
                phiEnd = phiRaw >= 0 ? phiRaw : phiRaw + Math.PI*2;
                if (phiEnd < Math.PI * 0.5) phiEnd += Math.PI*2;
            } else {
                // Tramo 4: D2s va de −D1 (cuadrante III) a (a,0) por cuadrante IV
                // phiRaw negativo en IV → normalizar y garantizar > phi_−D1
                phiEnd = phiRaw < 0 ? phiRaw + Math.PI*2 : phiRaw;
                const phi_mD1 = Math.atan2(-D1.y / b, -D1.x / a);
                const phi_mD1n = phi_mD1 < 0 ? phi_mD1 + Math.PI*2 : phi_mD1;
                if (phiEnd < phi_mD1n - 0.01) phiEnd += Math.PI*2;
            }
            const steps = Math.max(12, Math.round(phiEnd / (Math.PI*2) * 360));
            ctx.save();
            ctx.strokeStyle = col.ellipse;
            ctx.lineWidth   = col.strokeGrueso;
            ctx.lineCap     = "round";
            ctx.beginPath();
            for (let i = 0; i <= steps; i++) {
                const phi = (i / steps) * phiEnd;
                const ex = a * Math.cos(phi), ey = b * Math.sin(phi);
                i === 0 ? ctx.moveTo(vp.X(ex), vp.Y(ey)) : ctx.lineTo(vp.X(ex), vp.Y(ey));
            }
            ctx.stroke();
            ctx.restore();
        }
        if (state.showFoci) drawFoci(ctx, a, b, vp);

        if (alphaD1D2 > 0) {
            drawSegment(ctx, minusD1, D1,   col.barColor, col.strokeMedio, alphaD1D2, vp);
            drawSegment(ctx, minusD2, D2,   col.barColor, col.strokeMedio, alphaD1D2, vp);
        }

        // Lados cortos de los dos triángulos fijos: Cn↔D2 y −Cn↔−D2
        // Siempre visibles desde que aparecen los triángulos
        if (alphaTriang > 0 || t >= 0.25) {
            const aShort = t >= 0.25 ? 1 : alphaTriang;
            drawSegment(ctx, Cn,  D2,      "#000000", col.strokeFino, aShort, vp);
            drawSegment(ctx, mCn, minusD2, "#000000", col.strokeFino, aShort, vp);
        }

        // −OCnow es el extremo opuesto del diámetro
        const mOCnow = { x: -OCnow.x, y: -OCnow.y };

        if (alphaOC > 0) {
            // Diámetro completo: −OCnow ↔ OCnow
            drawSegment(ctx, mOCnow, OCnow, "#000000", col.strokeFino, alphaOC, vp);

            const alphaRect = alphaOC * easeOut3(remap01(t, 0.17, 0.19)) * (1 - easeOut3(remap01(t, 0.25, 0.28)));
            if (alphaRect > 0.01) {
                const szWorld = 10 / (vp.scale * (vp.userZoom || 1));
                const lenMD1 = Math.hypot(minusD1.x, minusD1.y) || 1;
                const uA = { x: minusD1.x / lenMD1, y: minusD1.y / lenMD1 };
                const lenOC = Math.hypot(OCnow.x, OCnow.y) || 1;
                const uB = { x: OCnow.x / lenOC,   y: OCnow.y / lenOC   };
                const q1 = { x: uA.x * szWorld,            y: uA.y * szWorld };
                const q2 = { x: (uA.x + uB.x) * szWorld,  y: (uA.y + uB.y) * szWorld };
                const q3 = { x: uB.x * szWorld,            y: uB.y * szWorld };
                ctx.save();
                ctx.globalAlpha = alphaRect;
                ctx.strokeStyle = "#000000";
                ctx.lineWidth   = col.strokeFino;
                ctx.beginPath();
                ctx.moveTo(vp.X(q1.x), vp.Y(q1.y));
                ctx.lineTo(vp.X(q2.x), vp.Y(q2.y));
                ctx.lineTo(vp.X(q3.x), vp.Y(q3.y));
                ctx.stroke();
                ctx.restore();
            }
        }

        // ── RASTROS DEL TRIÁNGULO VIAJERO ────────────────────────────────────
        // Un único barrido de s ∈ [−1, +1] sobre pivote=D1.
        // En cada s dibujamos DOS triángulos compartiendo vértice en P=s·D1:
        //   lado +: vC=Cn,  vD=D2   (triángulo derecho)
        //   lado −: vC=−Cn, vD=−D2  (triángulo izquierdo)
        // Solo dibujamos los que ya han sido visitados según t.
        if (state.showTrails && t >= 0.25) {
            // N par de divisiones del diámetro [−1,+1]: ds = 2/N, siempre equidistante
            // spacingToDivs ya da un N par mapeado desde el slider
            let N = spacingToDivs(state.spacing || 1.25);
            const ds = 2 / N;
            const aT  = 0.4;

            // Posición actual de s según el tramo
            const sNow = s; // ya calculado arriba para el triángulo activo

            // UN ÚNICO barrido de s ∈ [−1, +1] con paso ds fijo desde −1.
            // Todos los tramos usan el mismo conjunto de valores de s,
            // garantizando que los triángulos de ambos lados compartan vértice.
            //
            // Para s ∈ [−1, +1], P = s·D1  (cuando s<0, P apunta hacia −D1)
            // Tramo 1: s ∈ [sStop, 1],  lado+  (Cn,  D2)
            // Tramo 2: s ∈ [0,     1],  lado−  (−Cn, −D2)
            // Tramo 3: s ∈ [−1,    0],  lado−  (−Cn, −D2)  ← pivote≡−D1 = D1·(−s) con s<0
            // Tramo 4: s ∈ [−1, sStop], lado+  (Cn,  D2)

            // Posición actual del triángulo viajero en cada tramo
            const sNow1 = t<0.4375 ? sStop+(1-sStop)*(remap01(t,0.25,0.4375)) : 1;
            const sNow2 = t<0.625  ? 1-(remap01(t,0.4375,0.625))               : 0;
            const sNow3 = t<0.8125 ? -(remap01(t,0.625,0.8125))                : -1;
            const sNow4 = t<1.0    ? -1+(1+sStop)*(remap01(t,0.8125,1.0))      : sStop;

            for (let si = -1; si <= 1+1e-6; si += ds) {
                const sc = Math.min(Math.max(si,-1), 1);
                const kc = Math.sqrt(Math.max(0, 1-sc*sc));
                // Para s<0: P = s·D1 = |s|·(−D1), que es el pivote=−D1 del tramo 3
                const Pi = mul(D1, sc);

                // lado+: Cn, D2
                // Visitado en tramo1 (sc ∈ [sStop,sNow1]) o tramo4 (sc ∈ [−1,sNow4])
                const v1 = t>=0.25   && sc>=sStop  && sc<=sNow1;
                const v4 = t>=0.8125 && sc>=-1     && sc<=sNow4;
                if (v1 || v4) {
                    const Ci=add(Pi,mul(Cn,kc)), Di=add(Pi,mul(D2,kc));
                    drawSegment(ctx,Pi,Ci,'#000000',col.strokeFino,aT,vp);
                    drawSegment(ctx,Pi,Di,col.barColor,col.strokeFino,aT,vp);
                    drawSegment(ctx,Ci,Di,'#000000',col.strokeFino,aT,vp);
                }

                // lado−: −Cn, −D2
                // Visitado en tramo2 (sc ∈ [sNow2,1]) o tramo3 (sc ∈ [sNow3,0])
                const v2 = t>=0.4375 && sc>=sNow2  && sc<=1;
                const v3 = t>=0.625  && sc>=sNow3  && sc<=0;
                if (v2 || v3) {
                    const Ci=add(Pi,mul(mCn,kc)), Di=add(Pi,mul(minusD2,kc));
                    drawSegment(ctx,Pi,Ci,'#000000',col.strokeFino,aT,vp);
                    drawSegment(ctx,Pi,Di,col.barColor,col.strokeFino,aT,vp);
                    drawSegment(ctx,Ci,Di,'#000000',col.strokeFino,aT,vp);
                }
            }
        }

        if (alphaTriang > 0) {
            // Triángulo principal: P — Cs — D2s
            drawSegment(ctx, P,   Cs,  "#000000",    col.strokeFino,  alphaTriang, vp);
            drawSegment(ctx, P,   D2s, col.barColor, col.strokeMedio, alphaTriang, vp);
            drawSegment(ctx, Cs,  D2s, "#000000",    col.strokeFino,  alphaTriang, vp);

        }

        if (alphaD1D2 > 0) {
            drawPoint(ctx, 0,         0,         "#555555",    3, false, alphaD1D2, vp);
            drawPoint(ctx, D1.x,      D1.y,      col.barColor, 3, false, alphaD1D2, vp);
            drawPoint(ctx, minusD1.x, minusD1.y, col.barColor, 3, false, alphaD1D2, vp);
            drawPoint(ctx, D2.x,      D2.y,      "#0000FF",    4, false, alphaD1D2, vp);
            drawPoint(ctx, minusD2.x, minusD2.y, "#0000FF",    4, false, alphaD1D2, vp);
        }
        if (alphaOC > 0) {
            drawPoint(ctx,  OCnow.x,  OCnow.y, "#000000", 3, false, alphaOC, vp);
            drawPoint(ctx, -OCnow.x, -OCnow.y, "#000000", 3, false, alphaOC, vp);
        }
        if (alphaTriang > 0) {
            drawPoint(ctx,  P.x,   P.y,   "#555555", 3, false, alphaTriang, vp);
            drawPoint(ctx,  D2s.x, D2s.y, "#0000FF", 4, false, alphaTriang, vp);
            drawPoint(ctx,  Cs.x,  Cs.y,  "#000000", 3, false, alphaTriang, vp);

        }

        drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp);
        drawDialHUD(ctx, vp);
    });

})();