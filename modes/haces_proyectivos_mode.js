(function() {
    if (!window.ElipseLab) return;

    ElipseLab.registerMode('haces_proyectivos', (ctx, state, helpers) => {
        const { 
            viewport: vp, getColors, params,
            drawSegment, drawPoint, drawHandle,
            clamp01, drawFoci
        } = helpers;

        const col = getColors();
        const { a, b } = params();

        // --- LÓGICA DEL IMÁN (SNAP) ---
        let rawSkewX = state.skewX || 0;
        
        // Si está cerca de 0...
        if (Math.abs(rawSkewX) < 0.3) {
            rawSkewX = 0;
            // ¡ESTO ES LO NUEVO! 
            // Intentamos forzar al estado original a ser 0
            state.skewX = 0; 
        }
        
        const sX = rawSkewX;
        // ------------------------------

        // ESPACIADO
        const sRaw = (state.spacing !== undefined) ? state.spacing : 0.80;
        const minD = 4, maxD = 10, minS = 0.05, maxS = 2.50;
        const N = Math.max(minD, Math.round(maxD - ((sRaw - minS) / (maxS - minS)) * (maxD - minD)));

        const t = (state.t !== undefined) ? state.t : 1;
        const fMarco = clamp01(t * 4);
        const fTrazo = clamp01((t - 0.25) * 1.333);
        const invertSense = true;

        // Puntos geométricos (Todos usan 'sX' que es el valor con imán)
        const VL = { x: -a, y: 0 }, VR = { x:  a, y: 0 };
        const W = { x: sX, y: b }, W_Bot = { x: -sX, y: -b };
        const TopL = { x: -a + sX, y: b }, TopR = { x: a + sX, y: b };
        const BotL = { x: -a - sX, y: -b }, BotR = { x: a - sX, y: -b };

        const intersect = (p1, p2, p3, p4) => {
            const den = (p1.x - p2.x)*(p3.y - p4.y) - (p1.y - p2.y)*(p3.x - p4.x);
            if (Math.abs(den) < 1e-9) return null;
            return {
                x: ((p1.x*p2.y - p1.y*p2.x)*(p3.x - p4.x) - (p1.x - p2.x)*(p3.x*p4.y - p3.y*p4.x)) / den,
                y: ((p1.x*p2.y - p1.y*p2.x)*(p3.y - p4.y) - (p1.y - p2.y)*(p3.x*p4.y - p3.y*p4.x)) / den
            };
        };

        // 1) Rejilla técnica
        ctx.save();
        ctx.globalAlpha = fMarco * 0.3;
        const frame = [[TopL, TopR], [BotL, BotR], [VL, TopL], [VL, BotL],
                       [VR, TopR], [VR, BotR], [VL, VR], [W_Bot, W]];
        frame.forEach(l => drawSegment(ctx, l[0], l[1], col.axis, col.strokeFino, 1, vp));

        if (fMarco >= 1) {
            const drawDots = (pStart, pEnd) => {
                const dx = pEnd.x - pStart.x, dy = pEnd.y - pStart.y;
                for (let i = 0; i <= N; i++) {
                    const r = i / N;
                    drawPoint(ctx, pStart.x + dx * r, pStart.y + dy * r, col.axis, 2, false, 0.5, vp);
                }
            };
            drawDots(TopL, W);     drawDots(TopR, W);
            drawDots(BotL, W_Bot); drawDots(BotR, W_Bot);
            drawDots({x:0,y:0}, W); drawDots({x:0,y:0}, W_Bot);
        }
        ctx.restore();

        // 2) Cuadrantes y Proyecciones
        const quadrantsBase = [
            { f: VR, o: VL, c: BotR, e: W_Bot, rev: true  },
            { f: VL, o: VR, c: BotL, e: W_Bot, rev: false },
            { f: VL, o: VR, c: TopL, e: W,     rev: true  },
            { f: VR, o: VL, c: TopR, e: W,     rev: false }
        ];
        const Q = invertSense ? quadrantsBase.slice().reverse() : quadrantsBase;

        if (state.showTrails && fTrazo > 0) {
            const alphaTrail = (col.traceAlpha !== undefined ? col.traceAlpha : 0.30);
            const lwTrail = col.strokeFino || (1.2 * (vp.dpr || 1));
            const progress = fTrazo * Q.length;
            const currentIdx = Math.min(Q.length - 1, Math.floor(progress));
            const qProg = progress - currentIdx;

            Q.forEach((q, idx) => {
                if (!(idx < currentIdx || idx === currentIdx)) return;
                const revEff = (q.rev !== invertSense);
                for (let i = 0; i <= N; i++) {
                    const s = i / N;
                    if (idx === currentIdx && s > qProg) continue;
                    const r0 = revEff ? (1 - s) : s;
                    const rr = 1 - r0;
                    const pH = { x: q.c.x + (q.e.x - q.c.x) * rr, y: q.c.y };
                    const pV = { x: q.e.x * rr, y: q.e.y * rr };
                    const pt = intersect(q.f, pH, q.o, pV);
                    if (pt) {
                        drawSegment(ctx, q.f, pH, col.faint, lwTrail, alphaTrail, vp);
                        drawSegment(ctx, q.o, pt, col.faint, lwTrail, alphaTrail, vp);
                    }
                }
            });
        }

        // 3) Trazado de la elipse
        if (fTrazo > 0) {
            const progress = fTrazo * Q.length;
            const currentIdx = Math.min(Q.length - 1, Math.floor(progress));
            const qProg = progress - currentIdx;

            ctx.save(); ctx.beginPath();
            ctx.strokeStyle = col.ellipse; ctx.lineWidth = col.strokeGrueso;
            ctx.lineJoin = "round";
            let moved = false;

            Q.forEach((q, idx) => {
                const limit = (idx < currentIdx) ? 1 : (idx === currentIdx ? qProg : 0);
                if (limit <= 0) return;
                const pasos = 80;
                for (let i = 0; i <= pasos * limit; i++) {
                    const ri = i / pasos;
                    const revEff = (q.rev !== invertSense);
                    const r0 = revEff ? (1 - ri) : ri;
                    const r = 1 - r0;
                    const pH = { x: q.c.x + (q.e.x - q.c.x) * r, y: q.c.y };
                    const pV = { x: q.e.x * r, y: q.e.y * r };
                    const pt = intersect(q.f, pH, q.o, pV);
                    if (pt) {
                        if (!moved) { ctx.moveTo(vp.X(pt.x), vp.Y(pt.y)); moved = true; }
                        else { ctx.lineTo(vp.X(pt.x), vp.Y(pt.y)); }
                    }
                }
            });
            ctx.stroke(); ctx.restore();

            // Punto guía actual
            const q = Q[currentIdx];
            const revEff = (q.rev !== invertSense);
            const r0Real = revEff ? (1 - qProg) : qProg;
            const rReal = 1 - r0Real;
            const rSnap = Math.round(rReal * N) / N;
            const pHSnap = { x: q.c.x + (q.e.x - q.c.x) * rSnap, y: q.c.y };
            const pVSnap = { x: q.e.x * rSnap, y: q.e.y * rSnap };
            const ptNow = intersect(q.f, pHSnap, q.o, pVSnap);
            if (ptNow) {
                drawSegment(ctx, q.f, pHSnap, col.faint, col.strokeFino, 1, vp);
                drawSegment(ctx, q.o, ptNow,  col.faint, col.strokeFino, 1, vp);
                drawPoint(ctx, ptNow.x, ptNow.y, col.ellipse, 5/(vp.dpr||1), false, 1, vp);
            }
        }

        // 4) Tiradores y Puntos
        drawHandle(ctx, a, 0, col.handleA || "#ef4444", 'h', 1, vp);
        
        // Tirador Verde: dibujado usando 'sX' (con imán)
        const offW = 25 / (vp.scale * (state.userZoom || 1));
        drawHandle(ctx, a + sX + offW, b, "#10b981", 'h', 1, vp);
        
        drawPoint(ctx, VL.x, VL.y, "#4aa7ff", 5/(vp.dpr||1), true, 1, vp);
        drawPoint(ctx, VR.x, VR.y, col.foci, 5/(vp.dpr||1), true, 1, vp);

        if (state.showFoci) drawFoci(ctx, a, b, vp);
    });
})();