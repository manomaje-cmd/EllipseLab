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

    ElipseLab.registerMode('afinidad', (ctx, state, H) => {

        const { 
            viewport: vp, getColors, params, clamp01,
            drawSegment, drawPoint, drawHandle, drawFoci,
            drawAxesExact
        } = H;

        const { a, b } = params();
        const col = getColors();
        const t = state.t || 0; 

        // ---------- Cronograma ----------
        const fCircsFade  = clamp01(t * 12.5);
        const fRadioFade  = clamp01((t - 0.08) * 12.5); 
        const fGuiaFade   = clamp01((t - 0.16) * 11);
        const fGiro       = clamp01((t - 0.25) / 0.75);

        // Tangentes: aparecen con el giro y se van en el tramo final (último 3%)
        const fTangFade   = clamp01((t - 0.25) / 0.25);        // fade-in inicial
        const fTangOut    = clamp01(1 - (t - 0.97) / 0.03);    // fade-out final
        const fTangShow   = fTangFade * fTangOut;              // intensidad efectiva

        // Diámetros: visibles por defecto y fade-out en 0.25t; luego por botón
        const fDiamPreset   = (t < 0.25) ? (1 - t / 0.25) : 0;
        const wantUserDiams = !!state.showDiameters; // botón "Mostrar diámetros"
        const fDiams        = Math.max(fDiamPreset, wantUserDiams ? 1 : 0);

        // Ángulo actual del giro
        const angNow = (fGiro * Math.PI * 2);
        const cos = Math.cos(angNow);
        const sin = Math.sin(angNow);

        // Puntos clave
        const A = { x: a * cos, y: a * sin };
        const B = { x: b * cos, y: b * sin };
        const P = { x: A.x,     y: B.y };

        // ─────────────────────────────────────────────────────────────────────
        // Geometría de las tangentes
        // ─────────────────────────────────────────────────────────────────────
        const absCos = Math.abs(cos);
        const SINGULARITY_THRESHOLD = 0.08; // suprimir a ±~5° del eje Y
        const tangentsValid = absCos > SINGULARITY_THRESHOLD;

        // Longitud de segmento tangente a mostrar (proporcional a los semiejes)
        const tangLen = (a + b) * 0.55;

        // Extremos de la tangente a la circunferencia grande (en coords mundo)
        const tCirc0 = { x: A.x - sin * tangLen, y: A.y + cos * tangLen };
        const tCirc1 = { x: A.x + sin * tangLen, y: A.y - cos * tangLen };

        // Extremos de la tangente a la elipse en P (en coords mundo)
        // dirección normalizada de d_P = (−a·sinθ, b·cosθ)
        const dPlen = Math.hypot(a * sin, b * cos) || 1;
        const dPx = (-a * sin) / dPlen;
        const dPy = ( b * cos) / dPlen;
        const tElip0 = { x: P.x - dPx * tangLen, y: P.y - dPy * tangLen };
        const tElip1 = { x: P.x + dPx * tangLen, y: P.y + dPy * tangLen };

        // Punto de intersección Q sobre el eje mayor
        const Q = tangentsValid ? { x: a / cos, y: 0 } : null;

        // =====================================================
        // 0) Ejes (si showAxes) y tirador rojo SIEMPRE visible
        // =====================================================
        if (state.showAxes && typeof drawAxesExact === 'function') {
            drawAxesExact(ctx, a, b, vp);
        }
        // Tirador rojo del diámetro mayor: siempre visible (como en Fowler)
        drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp);

        // =====================================================
        // 0.b) FOCOS — solo a discreción del usuario (botón Mostrar focos)
        // =====================================================
        if (state.showFoci) {
            drawFoci(ctx, a, b, vp);
        }

        // =====================================================
        // 0.c) DIÁMETROS DE LA ELIPSE (mayor y menor)
        //      • Por defecto visibles y fade‑out en 0.25t
        //      • Luego, solo si state.showDiameters === true
        // =====================================================
        if (fDiams > 0) {
            const alpha = fDiams * (col.alphaMedio || 0.6);
            const lw = col.strokeFino || (1.2 * vp.dpr);
            const diamCol = col.circs || col.faint;

            // mayor (horizontal)
            drawSegment(ctx, { x: -a, y: 0 }, { x:  a, y: 0 }, diamCol, lw, alpha, vp);
            // menor (vertical)
            drawSegment(ctx, { x: 0, y: -b }, { x: 0, y:  b }, diamCol, lw, alpha, vp);
        }

        // =====================================================
        // 1) CIRCUNFERENCIAS PRINCIPALES
        // =====================================================
        if (fCircsFade > 0) {
            ctx.save();
            ctx.strokeStyle = col.circs;
            ctx.lineWidth = col.strokeFino;
            ctx.globalAlpha = fCircsFade * col.alphaMedio;

            [a, b].forEach(r => {
                ctx.beginPath();
                ctx.arc(
                    vp.X(0), vp.Y(0),
                    r * vp.scale * vp.userZoom,
                    0, Math.PI * 2
                );
                ctx.stroke();
            });

            ctx.restore();
        }

        // =====================================================
        // 2) RASTRO DE PROYECTANTES (con espaciado)
        // =====================================================
        if (fGiro > 0 && state.showTrails) {
            ctx.save();

            const densityFactor = (state.spacing || 0.8);
            const step = (Math.PI / 180) * (0.6 + densityFactor * 6);

            for (let angle = 0; angle <= (fGiro * Math.PI * 2); angle += step) {

                const cR = Math.cos(angle);
                const sR = Math.sin(angle);

                const pA = { x: a * cR, y: a * sR };
                const pB = { x: b * cR, y: b * sR };

                drawSegment(ctx, pA, {x: pA.x, y: pB.y}, col.faint, col.traceWidth, col.traceAlpha, vp);
                drawSegment(ctx, pB, {x: pA.x, y: pB.y}, col.faint, col.traceWidth, col.traceAlpha, vp);
            }

            ctx.restore();
        }

        // =====================================================
        // 3) MAQUINARIA ACTUAL (radio vector + proyectantes)
        // =====================================================
        if (fRadioFade > 0) {

            // Conexión A-B
            drawSegment(ctx, A, B, col.barColor, col.strokeMedio, fRadioFade * col.alphaFuerte, vp);

            // Radio principal
            drawSegment(ctx, {x:0, y:0}, A, col.circs, col.strokeFino, fRadioFade * col.alphaTenue, vp);

            if (fGuiaFade > 0) {
                drawSegment(ctx, A, P, col.faint, col.strokeMedio, fGuiaFade * col.alphaMedio, vp);
                drawSegment(ctx, B, P, col.faint, col.strokeMedio, fGuiaFade * col.alphaMedio, vp);
            }
        }

        // =====================================================
        // 4) ELIPSE (protagonista)
        // =====================================================
        if (fGiro > 0) {
            ctx.save();
            ctx.strokeStyle = col.ellipse;
            ctx.lineWidth   = col.strokeGrueso;
            ctx.lineCap = "round";

            ctx.beginPath();
            for (let i = 0; i <= fGiro + 0.002; i += 0.005) {
                const aT = (i * Math.PI * 2);
                ctx.lineTo(vp.X(a * Math.cos(aT)), vp.Y(b * Math.sin(aT)));
            }

            ctx.stroke();
            ctx.restore();
        }

        // =====================================================
        // 5) PUNTOS DINÁMICOS
        // =====================================================
        if (fRadioFade > 0) {

            const pCircSize = col.jointSize;
            const pTracer   = col.jointSize * 1.5;

            drawPoint(ctx, A.x, A.y, col.circs,   pCircSize, false, fRadioFade * col.alphaFuerte, vp);
            drawPoint(ctx, B.x, B.y, col.circs,   pCircSize, false, fRadioFade * col.alphaFuerte, vp);
            drawPoint(ctx, P.x, P.y, col.ellipse, pTracer,   fGiro > 0,  fRadioFade,              vp);
        }

        // =====================================================
        // 6) TANGENTES Y PUNTO DE INTERSECCIÓN EN EL EJE MAYOR
        // =====================================================
        //
        // Propiedad visualizada: la tangente a la circunferencia auxiliar en A
        // y la tangente a la elipse en el punto P correspondiente se cortan
        // SIEMPRE en un punto Q del eje mayor (eje X).
        // Q = (a/cosθ, 0) — independiente de b.
        //
        // Singularidad cosθ≈0: ambas tangentes son verticales y paralelas, Q
        // huye al infinito. En ese caso se siguen mostrando las tangentes con
        // su longitud fija (tangLen); solo se suprime la guía O→Q y el punto Q.
        // Además, al finalizar el timeline, todo esto hace fade-out para limpiar.
        // =====================================================

        if (fTangShow > 0 && fGiro > 0) {

            // Fade suave al acercarse a la singularidad (solo afecta a Q y guía)
            const nearSing = clamp01((absCos - SINGULARITY_THRESHOLD) / 0.12);
            const alpha = fTangShow;

            if (alpha > 0.01) {

                // ── Elegir el extremo de cada tangente que apunta "hacia Q" ──
                //
                // Construcción de los extremos (d_c = (−sinθ, cosθ), d_e normalizado):
                //   tCirc0 = A + tangLen·d_c   (s = +tangLen)
                //   tCirc1 = A − tangLen·d_c   (s = −tangLen)
                //   tElip0 = P − tangLen·d_e   (s = −tangLen)   ← convención OPUESTA
                //   tElip1 = P + tangLen·d_e   (s = +tangLen)
                //
                // Parámetro hasta Q: s_c = s_e ∝ −tanθ
                //   tanθ > 0 (Q I y III) → s < 0 → circ: tCirc1, elipse: tElip0
                //   tanθ < 0 (Q II y IV) → s > 0 → circ: tCirc0, elipse: tElip1
                const circUse1 = (sin * cos) >= 0;   // tanθ>0 → tCirc1 hacia Q
                const elipUse1 = (sin * cos) < 0;    // tanθ<0 → tElip1 hacia Q

                const tCircOpp = circUse1 ? tCirc0 : tCirc1;
                const tElipOpp = elipUse1 ? tElip0 : tElip1;

                let tCircQ, tElipQ;

                if (tangentsValid && Math.abs(Q.x) < 4 * a) {
                    // Recortamos en Q: la recta pasa exactamente por Q
                    tCircQ = Q;
                    tElipQ = Q;
                } else {
                    // Q no accesible: usar el extremo largo en la dirección correcta
                    tCircQ = circUse1 ? tCirc1 : tCirc0;
                    tElipQ = elipUse1 ? tElip1 : tElip0;
                }

                // --- Tangente a la circunferencia grande en A ---
                drawSegment(
                    ctx, tCircOpp, tCircQ,
                    col.circs,
                    col.strokeMedio,
                    alpha * col.alphaMedio,
                    vp
                );

                // --- Tangente a la elipse en P ---
                drawSegment(
                    ctx, tElipOpp, tElipQ,
                    col.ellipse,
                    col.strokeMedio,
                    alpha * col.alphaMedio,
                    vp
                );

                // --- Guía O→Q y punto Q (solo cuando Q es accesible) ─────────
                if (tangentsValid && Math.abs(Q.x) < 4 * a && nearSing > 0.01) {

                    // Guía con el mismo estilo que las circunferencias auxiliares
                    drawSegment(
                        ctx,
                        { x: 0, y: 0 },
                        Q,
                        col.circs,
                        col.strokeFino,
                        alpha * nearSing * col.alphaMedio,
                        vp
                    );

                    // Punto de intersección Q
                    drawPoint(
                        ctx,
                        Q.x, Q.y,
                        col.circs,
                        col.jointSize * 1.3,
                        true,
                        alpha * nearSing * col.alphaFuerte,
                        vp
                    );
                }
            }
        }

        ctx.restore();
    });
})();