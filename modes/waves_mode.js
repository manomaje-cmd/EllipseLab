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

    ElipseLab.registerMode('waves', (ctx, state, helpers) => {
        const {
            viewport: vp, getColors, params, clamp01,
            drawFoci, drawPoint, drawHandle, drawAxesExact, drawSegment
        } = helpers; // <-- Aquí solo se listan los nombres, SIN '==='

        const { a, b, c } = params();
        const col = getColors();
        const t = state.t || 0;

        // ─────────────────────────────────────────────
        // 0. EJES Y TIRADORES — Obediencia al core
        // ─────────────────────────────────────────────
        if (state.showAxes && typeof drawAxesExact === 'function') {
            // Dibuja los ejes de medida 2a y 2b del core
            drawAxesExact(ctx, a, b, vp);
        } else {
            // Solo tiradores si los ejes están apagados
            drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp); 
        }

        // ─────────────────────────────────────────────
        // 1. Ondas y Focos
        // ─────────────────────────────────────────────
        const fAuxiliaryFade = clamp01(1 - (t - 0.85) * 6.6);
        const waveColor = col.circs;

        const maxExpansion = 1.25;
        const expansionFactor = Math.min(maxExpansion, t * 1.6);
        const Rmax = (a + c) * expansionFactor;
        const S_target = 2 * a;

        const minSpacing = a * 0.06;
        const desired = Math.max(minSpacing, (state.spacing || 1) * 24);
        const lambda = S_target / Math.max(1, Math.round(S_target / desired));

        // ─────────────────────────────────────────────
        // 2. FOCOS — usamos estilo del core (drawFoci)
        // ─────────────────────────────────────────────
        drawFoci(ctx, a, b, vp);

        // ─────────────────────────────────────────────
        // 3. Ondas — tu código
        // ─────────────────────────────────────────────
        if (fAuxiliaryFade > 0) {
            const K = Math.min(60, Math.floor(Rmax / lambda));
            ctx.save();
            ctx.lineWidth = col.strokeFino;

            [-c, c].forEach(fx => {
                for (let k = 1; k <= K; k++) {
                    const r = k * lambda;
                    const alpha = Math.pow(1 - (r / Rmax), 0.8) * fAuxiliaryFade;
                    if (alpha <= 0.01) continue;

                    ctx.globalAlpha = alpha * 0.4;
                    ctx.strokeStyle = waveColor;

                    ctx.beginPath();
                    ctx.arc(
                        vp.X(fx), vp.Y(0),
                        r * vp.scale * vp.userZoom,
                        0, Math.PI * 2
                    );
                    ctx.stroke();
                }
            });

            ctx.restore();
        }

        const K_limit = Math.floor(Rmax / lambda);
        const pointRange = t * Math.PI;

        // ─────────────────────────────────────────────
        // 4. Elipses secundarias — tu código intacto
        // ─────────────────────────────────────────────
        ctx.save();
        ctx.lineWidth = col.strokeFino;

        for (let k1 = 1; k1 <= K_limit; k1++) {
            for (let k2 = k1; k2 <= K_limit; k2++) {
                const r1 = k1 * lambda;
                const r2 = k2 * lambda;
                const S_current = r1 + r2;

                if (Math.abs(S_current - S_target) < 0.001) continue;

                if (r1 + r2 >= 2*c && Math.abs(r1 - r2) <= 2*c) {
                    const a_sec = S_current / 2;
                    const b_sec2 = a_sec*a_sec - c*c;
                    if (b_sec2 >= 0) {
                        const b_sec = Math.sqrt(b_sec2);
                        const dFade = Math.pow(1 - (S_current / (2 * Rmax)), 1.2);

                        ctx.globalAlpha = 0.25 * dFade;
                        ctx.strokeStyle = waveColor;

                        const sweep = pointRange / 2;

                        ctx.beginPath();
                        ctx.ellipse(vp.X(0), vp.Y(0),
                            a_sec * vp.scale * vp.userZoom,
                            b_sec * vp.scale * vp.userZoom,
                            0,
                            Math.PI/2 - sweep, Math.PI/2 + sweep
                        );
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.ellipse(vp.X(0), vp.Y(0),
                            a_sec * vp.scale * vp.userZoom,
                            b_sec * vp.scale * vp.userZoom,
                            0,
                            -Math.PI/2 - sweep, -Math.PI/2 + sweep
                        );
                        ctx.stroke();
                    }
                }
            }
        }
        ctx.restore();

        // ─────────────────────────────────────────────
        // 5. Elipse principal — estilo del core, animación tuya
        // ─────────────────────────────────────────────
        const startThreshold = 0.25;
        if (t > startThreshold) {
            const tMapped = (t - startThreshold) / (1 - startThreshold);
            const sweep = (pointRange / 2) * tMapped;

            ctx.save();
            ctx.strokeStyle = col.ellipse;
            ctx.lineWidth = col.strokeGrueso;
            ctx.lineCap = "round";

            // semicircunferencias animadas, como tu código original
            ctx.beginPath();
            ctx.ellipse(
                vp.X(0), vp.Y(0),
                a * vp.scale * vp.userZoom,
                b * vp.scale * vp.userZoom,
                0,
                Math.PI/2 - sweep, Math.PI/2 + sweep
            );
            ctx.stroke();

            ctx.beginPath();
            ctx.ellipse(
                vp.X(0), vp.Y(0),
                a * vp.scale * vp.userZoom,
                b * vp.scale * vp.userZoom,
                0,
                -Math.PI/2 - sweep, -Math.PI/2 + sweep
            );
            ctx.stroke();

            ctx.restore();
        }

        // ─────────────────────────────────────────────
        // 6. Nodos — también intactos
        // ─────────────────────────────────────────────
        if (fAuxiliaryFade > 0.01) {
            ctx.save();

            for (let k1 = 1; k1 <= K_limit; k1++) {
                for (let k2 = 1; k2 <= K_limit; k2++) {
                    const r1 = k1 * lambda;
                    const r2 = k2 * lambda;

                    if (r1 + r2 >= 2*c && Math.abs(r1 - r2) <= 2*c) {
                        const x = (r1*r1 - r2*r2) / (2*(2*c) || 1e-9);
                        const y2 = r1*r1 - Math.pow(x + c, 2);

                        if (y2 >= 0) {
                            const y = Math.sqrt(y2);
                            const angle = Math.abs(Math.atan2(y, x));

                            if (Math.abs(angle - Math.PI/2) > pointRange/2) continue;

                            const S_current = r1 + r2;
                            const isMain = Math.abs(S_current - S_target) < 0.001;
                            const dFade = Math.pow(1 - (S_current / (2 * Rmax)), 1.2);
                            const pAlpha = (isMain ? 1.0 : 0.6) * dFade * fAuxiliaryFade;

                            if (pAlpha > 0.02) {
                                ctx.globalAlpha = pAlpha;
                                ctx.fillStyle = isMain ? col.ellipse : waveColor;

                                const rPoint = (isMain ? col.jointSize : col.jointSize * 0.5);

                                ctx.beginPath();
                                ctx.arc(vp.X(x), vp.Y(y), rPoint, 0, Math.PI * 2);
                                ctx.fill();

                                ctx.beginPath();
                                ctx.arc(vp.X(x), vp.Y(-y), rPoint, 0, Math.PI * 2);
                                ctx.fill();
                            }
                        }
                    }
                }
            }

            ctx.restore();
        }
    });
})();