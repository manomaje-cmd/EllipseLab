/**
 * Reglas del modo:
 *  - Solo usa draw(ctx, state, H). No toques DOM ni añadas eventos.
 *  - Dibuja en "mundo" (Y hacia arriba). Los helpers convierten a pantalla.
 *  - No uses internas (p.ej. H.viewport._xMin).
 *  - Ejes solo si state.showAxes === true, con H.drawAxesExact(...).
 * Helpers clave (ver modes/README.md):
 *  - H.params(), H.getColors(), H.drawAxesExact, H.drawSegment/Point/Ellipse/Foci/ArcWorld/Label...
 *  - H.viewport: X/Y/dpr/scale/zoom/pan (solo lectura)
 */
(function() {
    if (!window.ElipseLab) return;

    // Persistencia para detectar activación de latus rectum
    let lrDerechoActivo = false;
    let lrIzquierdoActivo = false;
    let lastT = 0;

    ElipseLab.registerMode('rombo_directriz', (ctx, state, helpers) => {
        const { 
            viewport: vp, params, getColors, easeInOutCubic,
            clamp01, drawSegment, drawPoint, drawAxesExact, drawFoci
        } = helpers;

        const { a, b, c } = params();
        const col = getColors();
        const tRaw = state.t || 0;

        // ─────────────────────────────────────────────
        // ESTÁNDARES MECÁNICOS DEL CORE
        // ─────────────────────────────────────────────
        const vCol   = col.barColor  || "#c2410c";
        const vAlpha = col.barAlpha  || 0.90;
        const vWidth = col.barWidth  || (2.5 * vp.dpr);
        const jSize  = col.jointSize || (3.5 * vp.dpr);

        const dX  = (c !== 0) ? a*a / c : 1e6;
        const rMin = a - c;
        const e = (a > 0 ? c / a : 0);

        // Sentido de avance (positivo por defecto)
        const SENSE = (state.reverse === true ? -1 : +1);

        // Reset al reiniciar animación
        if (tRaw < lastT || tRaw === 0) {
            lrDerechoActivo = false;
            lrIzquierdoActivo = false;
        }
        lastT = tRaw;

        // ─────────────────────────────────────────────
        // CRONOLOGÍA
        // ─────────────────────────────────────────────
        const fConstruccion   = clamp01(tRaw / 0.25);
        const fTrazado        = clamp01((tRaw - 0.25) / 0.75);

        const fIntroPrincipal = easeInOutCubic(clamp01(fConstruccion / 0.4));
        const fTrazoRombo     = easeInOutCubic(clamp01((fConstruccion - 0.3) * 3));
        const fDirectrices    = easeInOutCubic(clamp01((fConstruccion - 0.8) * 5));

        const fCrossPequenhos = easeInOutCubic(clamp01((fConstruccion - 0.4) * 4));
        const fFadePequenhos  = easeInOutCubic(clamp01((fConstruccion - 0.8) * 5));

        const fAlphaPrincipal = fIntroPrincipal * (1 - fCrossPequenhos);
        const fAlphaPequenhos = fCrossPequenhos * (1 - fFadePequenhos);

        // Utilidades de ángulos
        const TWO_PI = Math.PI * 2;
        const mod2pi = x => { let y = x % TWO_PI; if (y < 0) y += TWO_PI; return y; };
        const circDist = (a, b) => {
            const da = Math.abs(mod2pi(a) - mod2pi(b));
            return Math.min(da, TWO_PI - da);
        };

        // ─────────────────────────────────────────────
        // 1) EJES + TIRADORES + FOCOS
        // ─────────────────────────────────────────────
        drawAxesExact(ctx, a, b, vp);
        drawFoci(ctx, a, b, vp);

        // ─────────────────────────────────────────────
        // 2) GUÍAS INICIALES: circ. de radio a + mini-guias
        // ─────────────────────────────────────────────
        ctx.save();
        ctx.strokeStyle = col.circs;
        ctx.lineWidth   = vp.dpr;

        if (fAlphaPrincipal > 0) {
            ctx.globalAlpha = fAlphaPrincipal * 0.6;
            ctx.beginPath();
            ctx.arc(vp.X(0), vp.Y(0), a * vp.scale * vp.userZoom, 0, Math.PI * 2);
            ctx.moveTo(vp.X(0), vp.Y(a));
            ctx.lineTo(vp.X(0), vp.Y(-a));
            ctx.stroke();
        }

        if (fAlphaPequenhos > 0) {
            ctx.globalAlpha = fAlphaPequenhos * 0.6;
            [a, -a].forEach(x => {
                ctx.beginPath();
                ctx.arc(vp.X(x), vp.Y(0), rMin * vp.scale * vp.userZoom, -Math.PI/2, Math.PI/2, x > 0);
                ctx.moveTo(vp.X(x), vp.Y(rMin));
                ctx.lineTo(vp.X(x), vp.Y(-rMin));
                ctx.stroke();
            });
        }
        ctx.restore();

        // ─────────────────────────────────────────────
        // 3) DIRECTRICES (líneas verticales)
        // ─────────────────────────────────────────────
        if (fDirectrices > 0 && c !== 0) {
            ctx.save();
            ctx.strokeStyle = col.axis;
            ctx.lineWidth   = vp.dpr;
            ctx.globalAlpha = fDirectrices;
            ctx.setLineDash([5,5]);
            const h = a * 2.5;
            [-dX, dX].forEach(x => {
                ctx.beginPath();
                ctx.moveTo(vp.X(x), vp.Y(-h));
                ctx.lineTo(vp.X(x), vp.Y(h));
                ctx.stroke();
            });
            ctx.restore();
        }

        // ─────────────────────────────────────────────
        // 4) ROMBO + GLOW (Sincronizado exacto)
        // ─────────────────────────────────────────────
        if (fTrazoRombo > 0 && c !== 0) {
            const angAct = SENSE * fTrazado * TWO_PI;
            
            // Ángulo para x = +c (Superior Derecho) y x = -c (Inferior Izquierdo)
            const uLR_Der = Math.acos(clamp01(e)); 
            const uLR_Izq = Math.PI + Math.acos(clamp01(e));

            const glow = (target) => {
                const d = circDist(angAct, SENSE * target);
                return Math.exp(-((d * 12)**2)); 
            };

            const g1 = glow(uLR_Der); // Glow Sup. Der.
            const g2 = glow(uLR_Izq); // Glow Inf. Izq.

            ctx.save();
            const alphaBase = fTrazoRombo * 0.4;
            // Lados estáticos del rombo
            drawSegment(ctx, {x:0, y:a},   {x:dX, y:0},  col.circs, vp.dpr, alphaBase, vp);
            drawSegment(ctx, {x:dX, y:0},  {x:0, y:-a}, col.circs, vp.dpr, alphaBase, vp);
            drawSegment(ctx, {x:0, y:-a}, {x:-dX, y:0}, col.circs, vp.dpr, alphaBase, vp);
            drawSegment(ctx, {x:-dX, y:0}, {x:0, y:a},  col.circs, vp.dpr, alphaBase, vp);

            // Capa de Glow Dinámico en los lados solicitados
            const edges = [
                { p1:{x:0, y:a},   p2:{x:dX, y:0},  g:g1 }, // Lado Superior Derecho
                { p1:{x:-dX, y:0}, p2:{x:0, y:-a}, g:g2 }  // Lado Inferior Izquierdo
            ];

            edges.forEach(ed => {
                if (ed.g > 0.01) {
                    ctx.save();
                    ctx.shadowBlur = 15 * ed.g * vp.dpr;
                    ctx.shadowColor = vCol;
                    drawSegment(ctx, ed.p1, ed.p2, vCol, (1.5 + ed.g * 3) * vp.dpr, ed.g, vp);
                    ctx.restore();
                }
            });
            ctx.restore();
        }

        // ─────────────────────────────────────────────
        // 5) TRAZADO DE LA ELIPSE + LATUS RECTUM
        // ─────────────────────────────────────────────
        if (fTrazado > 0) {
            const angAct = SENSE * fTrazado * TWO_PI;
            const currX  = a * Math.cos(angAct);
            const currY  = b * Math.sin(angAct);

            // Activación basada en cruce de focos
            if (c !== 0) {
                const uR = Math.acos(clamp01(e));
                const uL = Math.PI - Math.acos(clamp01(e));
                if (!lrDerechoActivo   && fTrazado >= (uR / TWO_PI) - 1e-6) lrDerechoActivo   = true;
                if (!lrIzquierdoActivo && fTrazado >= (uL / TWO_PI) - 1e-6) lrIzquierdoActivo = true;
            }

            // Dibujar Latus Rectum cuando se activan
            const semiLR = (b * b) / a;
            ctx.save();
            ctx.strokeStyle = col.axis;
            ctx.lineWidth   = vp.dpr * 1.5;
            if (lrDerechoActivo) drawSegment(ctx, {x:c, y:-semiLR}, {x:c, y:semiLR}, col.axis, vp.dpr * 1.5, 0.8, vp);
            if (lrIzquierdoActivo) drawSegment(ctx, {x:-c, y:-semiLR}, {x:-c, y:semiLR}, col.axis, vp.dpr * 1.5, 0.8, vp);
            ctx.restore();

            // Elipse azul animada
            ctx.save();
            ctx.strokeStyle = col.ellipse;
            ctx.lineWidth   = col.strokeGrueso;
            ctx.beginPath();
            for (let i = 0; i <= fTrazado + 0.005; i += 0.005) {
                const angE = SENSE * i * TWO_PI;
                ctx.lineTo(vp.X(a * Math.cos(angE)), vp.Y(b * Math.sin(angE)));
            }
            ctx.stroke();
            ctx.restore();

            // ====== REBOTE MECÁNICO ======
            const fX = c;
            const rAct = Math.sqrt((currX - fX)**2 + currY**2);
            const yTang = +rAct;
            const xReb  = (a - yTang) * (dX / a);

            ctx.save();
            ctx.strokeStyle = col.circs;
            ctx.lineWidth   = vp.dpr;
            ctx.globalAlpha = 0.8;

            ctx.beginPath();
            ctx.arc(vp.X(fX), vp.Y(0), rAct * vp.scale * vp.userZoom, 0, Math.PI*2);
            ctx.stroke();

            ctx.setLineDash([4,4]);
            ctx.beginPath();
            ctx.moveTo(vp.X(fX), vp.Y(0));
            ctx.lineTo(vp.X(fX), vp.Y(yTang));
            ctx.stroke();

            if (xReb < 0) {
                ctx.beginPath();
                ctx.moveTo(vp.X(0), vp.Y(a));
                ctx.lineTo(vp.X(xReb), vp.Y(yTang));
                ctx.stroke();
            }

            ctx.setLineDash([]);
            ctx.strokeStyle = vCol;
            ctx.lineWidth   = vWidth * 0.7;
            ctx.globalAlpha = vAlpha;

            ctx.beginPath();
            ctx.moveTo(vp.X(fX),   vp.Y(yTang)); 
            ctx.lineTo(vp.X(xReb), vp.Y(yTang));
            ctx.lineTo(vp.X(xReb), vp.Y(currY)); 
            ctx.stroke();

            drawPoint(ctx, currX, currY, col.ellipse, jSize * 1.5, true, 1, vp);
            ctx.restore();
        }

        // ─────────────────────────────────────────────
        // 6) CIERRE FINAL
        // ─────────────────────────────────────────────
        if (fTrazado >= 0.99) {
            ctx.save();
            ctx.strokeStyle = col.ellipse;
            ctx.lineWidth   = col.strokeGrueso;
            ctx.beginPath();
            ctx.ellipse(vp.X(0), vp.Y(0), a * vp.scale * vp.userZoom, b * vp.scale * vp.userZoom, 0, 0, TWO_PI);
            ctx.stroke();
            ctx.restore();
        }
    });
})();