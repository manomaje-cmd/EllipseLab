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

    ElipseLab.registerMode('2focales', (ctx, state, H) => {
        const { 
            viewport: vp, getColors, params, clamp01,
            drawPoint, drawHandle, drawFoci, drawAxesExact
        } = H;

        const { a, b, c } = params();
        const col = getColors();
        const t = state.t || 0;
        const L = 2 * a;
        const density = state.spacing || 0.8;

        // Cronograma
        const fDirectorasFade  = clamp01(t * 12.5);
        const fGuiaFade        = clamp01((t - 0.08) * 12.5);
        const fCircRodanteFade = clamp01((t - 0.16) * 11);
        const fGiro            = clamp01((t - 0.25) / 0.75);

        // === Halo para despejar focos (igual que en modo “focal”) ===
        const haloPx = Math.max(4, (state.focusHaloPx || col.focusHaloPx || 5) * (vp.dpr || 1));

        function clearFocusHalo(xWorld, yWorld, pxRadius) {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(vp.X(xWorld), vp.Y(yWorld), pxRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // --- Ejes y tiradores ---
        if (state.showAxes && typeof drawAxesExact === 'function') {
            drawAxesExact(ctx, a, b, vp);
        } else {
            drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp);
        }

        // Focos (se repintan al final también; aquí es el fade/visible base)
        drawFoci(ctx, a, b, vp);

        ctx.save();

        // 1) Circunferencias directoras (centros ±c, radio = 2a)
        if (fDirectorasFade > 0) {
            ctx.save();
            ctx.strokeStyle = col.foci;
            ctx.lineWidth   = col.strokeFino;
            ctx.globalAlpha = fDirectorasFade * col.alphaTenue;

            [-c, c].forEach(fx => {
                ctx.beginPath();
                ctx.arc(vp.X(fx), vp.Y(0), L * vp.scale * vp.userZoom, 0, Math.PI * 2);
                ctx.stroke();
            });

            ctx.restore();
        }

        // 2) Elipse principal (parcial)
        if (fGiro > 0) {
            ctx.save();
            ctx.strokeStyle = col.ellipse;
            ctx.lineWidth   = col.strokeGrueso;
            ctx.lineCap     = "round";
            ctx.beginPath();

            for (let i = 0; i <= fGiro + 0.005; i += 0.01) {
                const u  = i * Math.PI * 2;
                const px = a * Math.cos(u);
                const py = b * Math.sin(u);
                if (i === 0) ctx.moveTo(vp.X(px), vp.Y(py));
                else          ctx.lineTo(vp.X(px), vp.Y(py));
            }
            ctx.stroke();
            ctx.restore();
        }

        // 3) Malla de circunferencias (radio = dist a foco activo)
        if (fGiro > 0 && state.showTrails) {
            ctx.save();
            ctx.strokeStyle = col.traceColor;
            ctx.lineWidth   = col.traceWidth;
            ctx.globalAlpha = col.traceAlpha;

            const pasosMax      = Math.floor(120 / (density + 0.1));
            const pasosActuales = Math.floor(pasosMax * fGiro);

            for (let i = 0; i <= pasosActuales; i++) {
                const progress = i / pasosMax;
                const ang = progress * Math.PI * 2;

                const mx = a * Math.cos(ang);
                const my = b * Math.sin(ang);

                const fx = (progress < 0.25 || progress > 0.75) ? c : -c;
                const radio = Math.hypot(mx - fx, my);

                ctx.beginPath();
                ctx.arc(vp.X(mx), vp.Y(my), radio * vp.scale * vp.userZoom, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();

            // Despejamos ambos focos
            clearFocusHalo(+c, 0, haloPx);
            clearFocusHalo(-c, 0, haloPx);
        }

        // 4) Circunferencia instantánea + glow
        const angNow = fGiro * Math.PI * 2;
        const mxN = a * Math.cos(angNow);
        const myN = b * Math.sin(angNow);

        const fxP = (fGiro < 0.25 || fGiro > 0.75) ? c : -c;
        const rNow = Math.hypot(mxN - fxP, myN);

        const distSup = Math.abs(fGiro - 0.25);
        const distInf = Math.abs(fGiro - 0.75);
        const proximidad = Math.min(distSup, distInf);
        const glowFactor = Math.max(0, 1 - proximidad / 0.06);

        if (glowFactor > 0 && fGiro > 0) {
            ctx.save();
            ctx.shadowBlur  = 20 * glowFactor * (vp.dpr || 1);
            ctx.shadowColor = col.ellipse;
            ctx.strokeStyle = col.ellipse;
            ctx.lineWidth   = col.strokeGrueso * 1.5;
            ctx.globalAlpha = glowFactor * col.alphaFuerte;

            ctx.beginPath();
            ctx.arc(vp.X(mxN), vp.Y(myN), rNow * vp.scale * vp.userZoom, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // Vuelve a despejar focos si la instantánea pasa por ellos
            clearFocusHalo(+c, 0, haloPx);
            clearFocusHalo(-c, 0, haloPx);
        }

        // 5) Circunferencia “rodante” + guía
        if (fCircRodanteFade > 0) {
            ctx.save();
            ctx.strokeStyle = col.circs;
            ctx.lineWidth   = col.strokeMedio;
            ctx.globalAlpha = fCircRodanteFade * col.alphaFuerte;

            ctx.beginPath();
            ctx.arc(vp.X(mxN), vp.Y(myN), rNow * vp.scale * vp.userZoom, 0, Math.PI * 2);
            ctx.stroke();

            if (fGuiaFade > 0) {
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = col.foci;
                ctx.lineWidth   = col.strokeFino;
                ctx.globalAlpha = fGuiaFade * col.alphaMedio;

                ctx.beginPath();
                ctx.moveTo(vp.X(fxP), vp.Y(0));
                ctx.lineTo(vp.X(mxN), vp.Y(myN));
                ctx.stroke();
            }

            ctx.restore();

            // Y otra vez proteger focos
            clearFocusHalo(+c, 0, haloPx);
            clearFocusHalo(-c, 0, haloPx);
        }

        // 6) Trazador
        if (fGuiaFade > 0) {
            drawPoint(ctx, mxN, myN, col.ellipse, col.jointSize * 1.5, true, fGuiaFade, vp);
        }

        // 7) FOCOS (último paso para que queden nítidos)
        drawFoci(ctx, a, b, vp);

        ctx.restore();
    });
})();