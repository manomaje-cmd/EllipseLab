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

    ElipseLab.registerMode('van_schooten', (ctx, state, helpers) => {
        const {
            viewport: vp, getColors, params, clamp01,
            drawSegment, drawPoint, drawAxesExact,
            drawHandle,
            drawCircleWorld 
        } = helpers;

        const { a, b, c } = params();
        const col = getColors();
        const t = state.t || 0;

        // --- ESTÁNDARES DE MECÁNICA (gobernados por paleta del core) ---
        const vCol   = col.barColor  || "#c2410c";  // Naranja óxido técnico
        const vAlpha = col.barAlpha  || 0.90;       // Casi opaco
        const vWidth = col.barWidth  || (2.5 * vp.dpr);
        const jSize  = col.jointSize || (3.5 * vp.dpr);

        // Geometría del mecanismo
        const L_focal = 2 * a; // radio de las circunferencias focales (directrices)
        const L_guia  = 4 * a; // longitud de la guía "tangente"

        // Cronograma
        const fCircsFade = clamp01(t * 12.5);          // 0.00 → 0.08
        const fGuiaFade  = clamp01((t - 0.08) * 12.5); // 0.08 → 0.16
        const fRestoFade = clamp01((t - 0.16) * 11);   // 0.16 → 0.25
        const fGiro      = clamp01((t - 0.25) / 0.75); // 0.25 → 1.00

        // Utilidades geométricas
        const ellipsePoint = (u) => ({ x: a * Math.cos(u), y: b * Math.sin(u) });
        const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

        // ─────────────────────────────────────────────────────────────
        // CINEMÁTICA INSTANTÁNEA (AHORA CCW/ANTIHORARIO)
        // ─────────────────────────────────────────────────────────────
        // Antes: ang = -fGiro * 2π (horario). Ahora CCW: ang = +fGiro * 2π.
        const ang   = fGiro * Math.PI * 2;
        const pAct  = ellipsePoint(ang);
        const F1    = { x: -c, y: 0 }, F2 = { x:  c, y: 0 };

        // Proyección sobre circunferencia focal centrada en F1 (radio 2a)
        const dF1P  = distance(pAct.x, pAct.y, F1.x, F1.y) || 1e-9;
        const N_act = {
            x: F1.x + (L_focal / dF1P) * (pAct.x - F1.x),
            y: F1.y + (L_focal / dF1P) * (pAct.y - F1.y)
        };

        // Punto medio con F2 → |M| = a
        const M_act  = { x: (N_act.x + F2.x) / 2, y: N_act.y / 2 };

        // Dirección de la varilla tangente (perpendicular al radio desde F2 hasta N_act)
        const baseVX = N_act.x - F2.x, baseVY = N_act.y;
        const dirX   = -baseVY, dirY = baseVX;
        const magDir = Math.hypot(dirX, dirY) || 1;
        const ux     = dirX / magDir, uy = dirY / magDir;

        // Intersección de la recta por M_act con la circunferencia de centro F2 y radio L_focal
        const dx = M_act.x - F2.x, dy = M_act.y;
        const B  = 2 * (dx * ux + dy * uy);
        const C  = dx * dx + dy * dy - L_focal * L_focal;
        const disc = Math.max(0, B * B - 4 * C);

        let p1 = M_act, p2 = M_act;
        if (disc >= 0) {
            const sD = Math.sqrt(disc);
            const k1 = (-B + sD) / 2, k2 = (-B - sD) / 2;
            p1 = { x: M_act.x + k1 * ux, y: M_act.y + k1 * uy };
            p2 = { x: M_act.x + k2 * ux, y: M_act.y + k2 * uy };
        }

        const guiaInicio = p1;
        const dirFactor  = ((p2.x - p1.x) * ux + (p2.y - p1.y) * uy) > 0 ? 1 : -1;
        const guiaFin    = { x: p1.x + (ux * dirFactor) * L_guia, y: p1.y + (uy * dirFactor) * L_guia };

        // ─────────────────────────────────────────────────────────────
        // 0) EJES A DEMANDA + TIRADORES
        // ─────────────────────────────────────────────────────────────
        // Los ejes solo se dibujan si la casilla "Mostrar ejes" está activa
        if (state.showAxes) {
            drawAxesExact(ctx, a, b, vp);
        }

        // Los tiradores (handles) suelen dejarse siempre para poder 
        // editar la elipse, pero si quieres que también sigan a la 
        // casilla de ejes, mételos dentro del 'if' anterior.
        drawHandle(ctx, a, 0, '#ff0000', 'h', 1, vp);
       

        // ─────────────────────────────────────────────────────────────
        // 1) CIRCUNFERENCIAS DIRECTRICES (Radio 2a) — estilo del core
        // ─────────────────────────────────────────────────────────────
        if (fCircsFade > 0) {
            // Preferimos helper del core (mundo Y↑). Si no estuviera, fallback en píxeles.
            if (typeof drawCircleWorld === 'function') {
                ctx.save(); ctx.globalAlpha = fCircsFade * col.alphaTenue;
                drawCircleWorld(ctx, F1.x, F1.y, L_focal, col.foci, col.strokeFino, 1.0, vp);
                drawCircleWorld(ctx, F2.x, F2.y, L_focal, col.foci, col.strokeFino, 1.0, vp);
                ctx.restore();
            } else {
                ctx.save();
                ctx.lineWidth   = col.strokeFino;
                ctx.strokeStyle = col.circs;
                ctx.globalAlpha = fCircsFade * col.alphaTenue;
                [F1, F2].forEach(f => {
                    ctx.beginPath();
                    ctx.arc(
                        vp.X(f.x), vp.Y(f.y),
                        L_focal * vp.scale * vp.userZoom,
                        0, Math.PI * 2
                    );
                    ctx.stroke();
                });
                ctx.restore();
            }
        }

        // ─────────────────────────────────────────────────────────────
        // 2) ELIPSE (trazo principal, parcial con animación) — azul core
        //     AHORA CCW/ANTIHORARIO, coherente con el resto de modos.
        // ─────────────────────────────────────────────────────────────
        if (fGiro > 0) {
            ctx.save();
            ctx.strokeStyle = col.ellipse;
            ctx.lineWidth   = col.strokeGrueso;
            ctx.lineCap     = "round";
            ctx.lineJoin    = "round";

            // Trazado paramétrico incremental CCW desde u=0 hasta u=fGiro·2π
            const uMax = fGiro * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(vp.X(a * Math.cos(0)), vp.Y(b * Math.sin(0)));
            // paso pequeño para suavidad uniforme
            const du = Math.PI / 180; // ~1°
            for (let u = du; u <= uMax + 1e-6; u += du) {
                ctx.lineTo(vp.X(a * Math.cos(u)), vp.Y(b * Math.sin(u)));
            }
            ctx.stroke();
            ctx.restore();
        }

        // ─────────────────────────────────────────────────────────────
        // 3) VARA TANGENTE (sólida)
        // ─────────────────────────────────────────────────────────────
        if (fGuiaFade > 0) {
            drawSegment(ctx, guiaInicio, guiaFin, vCol, vWidth * 1.3, fGuiaFade * vAlpha, vp);
        }

        // ─────────────────────────────────────────────────────────────
        // 4) FOCOS (Siempre visibles desde el inicio)
        // ─────────────────────────────────────────────────────────────
        drawPoint(ctx, F1.x, F1.y, col.foci, 4 * vp.dpr, false, 1.0, vp);
        drawPoint(ctx, F2.x, F2.y, col.foci, 4 * vp.dpr, false, 1.0, vp);

        // ─────────────────────────────────────────────────────────────
        // 5) ANTIPARALELOGRAMO + joints + lápiz trazador
        // ─────────────────────────────────────────────────────────────
        if (fRestoFade > 0) {
            ctx.save();

            // Lados del rombo articulado
            const links = [
                { a: p1, b: F2 }, { a: p1, b: N_act },
                { a: p2, b: F2 }, { a: p2, b: N_act }
            ];
            links.forEach(s => drawSegment(ctx, s.a, s.b, vCol, vWidth, fRestoFade * vAlpha, vp));

            // Radio vector (más fino)
            drawSegment(ctx, F1, N_act, vCol, vWidth * 0.6, fRestoFade * 0.4, vp);

            // Uniones mecánicas (joints móviles, excepto los focos fijos que ya dibujamos)
            [N_act, p1, p2].forEach(p => {
                drawPoint(ctx, p.x, p.y, vCol, jSize, false, fRestoFade, vp);
            });

            // Lápiz trazador (sobre la elipse)
            drawPoint(ctx, pAct.x, pAct.y, col.ellipse, jSize * 1.6, fGiro > 0, fRestoFade, vp);

            ctx.restore();
        }
    });
})();