/**
 * cuadrado_mode.js - ElipseLab Pro
 * Construcción de la elipse mediante bastidor cuadrado y vara deslizante
 */
(function () {
    if (!window.ElipseLab) return;

    ElipseLab.registerMode('cuadrado', (ctx, state, helpers) => {
        const {
            viewport: vp, getColors, params,
            drawSegment, drawPoint, drawAxesExact,
            drawFoci,
            clamp01, drawCircleWorld, drawHandle
        } = helpers;

        const { a, b } = params();
        const col = getColors();
        const t = state.t || 0;

        // ── Estilos ─────────────────────────────────────────────
        const vCol   = col.foci;
        const vAlpha = col.barAlpha  || 0.90;
        const vWidth = col.barWidth  || (2.5 * vp.dpr);
        const jSize  = col.jointSize || (3.5 * vp.dpr);
        const gris   = col.faint     || '#888888';
        const aGris  = col.alphaTenue || 0.3;

        // ── Parámetros geométricos ──────────────────────────────
        const L = a + b;   // longitud de la vara
        const r = L;       // lado del bastidor cuadrado

        // ── Fases de animación ──────────────────────────────────
        const fMoveC1   = clamp01((t - 0.05) / 0.04);
        const fVaraFade = clamp01((t - 0.15) * 20);
        const fGiro     = clamp01((t - 0.25) / 0.75);
        const theta     = fGiro * Math.PI * 2;

        // ── Puntos clave ────────────────────────────────────────
        const H = { x: L * Math.cos(theta), y: 0 };
        const V = { x: 0,                   y: L * Math.sin(theta) };
        const P = { x: a * Math.cos(theta), y: b * Math.sin(theta) };

        const hPos = fGiro > 0 ? H : { x: L * fMoveC1, y: 0 };
        const vPos = fGiro > 0 ? V : { x: 0, y: 0 };

        // ── 0) Focos ───────────────────────────────────────────
        if (state.showFoci) {
            drawFoci(ctx, a, b, vp);
        }

        // ── 1) Ejes ─────────────────────────────────────────────
        state.showAxes = true;
        const fAxesFade = 1 - clamp01(fGiro / 0.12);

        if (fAxesFade > 0) {
            const axAlpha = fAxesFade * (col.alphaTenue || 1.0);
            drawSegment(ctx, { x: -a, y: 0 }, { x: a, y: 0 }, col.axis, col.strokeFino, axAlpha, vp);
            drawSegment(ctx, { x: 0, y: -b }, { x: 0, y: b }, col.axis, col.strokeFino, axAlpha, vp);
        } else {
            drawAxesExact(ctx, a, b, vp);
        }

        drawHandle(ctx, a, 0, '#ff0000', 'h', 1, vp);

        // ── 2) Bastidor cuadrado ────────────────────────────────
        if (fVaraFade > 0) {
            const alpha = fVaraFade * aGris;

            // contorno
            drawSegment(ctx, { x: -r, y:  r }, { x:  r, y:  r }, gris, col.strokeFino, alpha, vp);
            drawSegment(ctx, { x: -r, y: -r }, { x:  r, y: -r }, gris, col.strokeFino, alpha, vp);
            drawSegment(ctx, { x:  r, y: -r }, { x:  r, y:  r }, gris, col.strokeFino, alpha, vp);
            drawSegment(ctx, { x: -r, y: -r }, { x: -r, y:  r }, gris, col.strokeFino, alpha, vp);

            // medianas
            drawSegment(ctx, { x: -r, y: 0 }, { x: r,  y: 0 }, gris, col.strokeFino, alpha, vp);
            drawSegment(ctx, { x: 0,  y:-r }, { x: 0,  y: r }, gris, col.strokeFino, alpha, vp);
        }

        // ── 3) Circunferencia auxiliar inicial ─────────────────
        const alphaC1 = aGris * (1 - fVaraFade);
        if (alphaC1 > 0) {
            const posX1 = a * fMoveC1;
            drawCircleWorld(ctx, posX1, 0, b, gris, col.strokeFino, alphaC1, vp);

            if (fMoveC1 > 0.95) {
                drawPoint(ctx, a, 0, col.ellipse, jSize, true,  alphaC1 * 2, vp);
                drawPoint(ctx, L, 0, vCol,        jSize * 0.8, false, alphaC1 * 2, vp);
            }
        }

        // ── 4) Circunferencias de los extremos ─────────────────
        const alphaGrandes = aGris * fVaraFade;

        if (alphaGrandes > 0 && fGiro === 0) {
            drawCircleWorld(ctx, hPos.x, hPos.y, r, gris, col.strokeFino, alphaGrandes, vp);
            drawCircleWorld(ctx, vPos.x, vPos.y, r, gris, col.strokeFino, alphaGrandes, vp);
        }

        if (fGiro > 0) {
            drawCircleWorld(ctx, H.x, H.y, r, gris, col.strokeFino, aGris, vp);
            drawCircleWorld(ctx, V.x, V.y, r, gris, col.strokeFino, aGris, vp);
        }

        // ── 5) Vara deslizante ─────────────────────────────────
        if (fVaraFade > 0) {
            const curAlpha = fVaraFade * vAlpha;

            if (fGiro === 0) {
                drawSegment(ctx, { x: 0, y: 0 }, { x: L, y: 0 }, col.barColor, vWidth, curAlpha, vp);
                drawPoint(ctx, a, 0, col.ellipse, jSize * 1.2, true, fVaraFade, vp);
            } else {
                drawSegment(ctx, H, V, col.barColor, vWidth, curAlpha, vp);
                drawPoint(ctx, H.x, H.y, col.barColor, jSize, false, fVaraFade, vp);
                drawPoint(ctx, V.x, V.y, col.barColor, jSize, false, fVaraFade, vp);
            }
        }

        // ── 6) Elipse generada ─────────────────────────────────
        if (fGiro > 0) {
            ctx.save();
            ctx.strokeStyle = col.ellipse;
            ctx.lineWidth   = col.strokeGrueso;
            ctx.lineJoin    = 'round';

            ctx.beginPath();
            const uMax = fGiro * Math.PI * 2;

            for (let u = 0; u <= uMax + 0.02; u += 0.02) {
                const px = a * Math.cos(u);
                const py = b * Math.sin(u);
                if (u === 0) ctx.moveTo(vp.X(px), vp.Y(py));
                else         ctx.lineTo(vp.X(px), vp.Y(py));
            }

            ctx.stroke();
            ctx.restore();

            drawPoint(ctx, P.x, P.y, col.ellipse, jSize * 1.5, true, 1, vp);
        }
    });
})();