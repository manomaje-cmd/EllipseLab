/**
 * Modo: Excentricidad (Basado en la relación Foco-Directriz)
 */
(function() {
    if (!window.ElipseLab) return;

    function drawExcentricidad(ctx, state, helpers) {
        const { 
            viewport: vp, params, getColors, clamp01, 
            drawSegment, drawPoint, drawFoci, drawAxesExact,
            drawHandle 
        } = helpers;        

        const { a, b, c } = params();
        const col = getColors();
        const tRaw = state.t || 0;

        // 1. Cálculos base
        const dX = (c !== 0) ? a * a / c : 1e6; 
        const excentricidad = (a > 0) ? c / a : 0;

        // 2. Cronología
        const fIntro   = clamp01(tRaw * 10);
        const fTrazado = clamp01((tRaw - 0.25) / 0.75);

        // 3. Ejes / Tirador (Prioridad de interacción)
        if (state.showDiameters === true || state.showAxes === true) {
            drawAxesExact(ctx, a, b, vp);
        } else {
            // Tirador rojo para modificar el semieje mayor 'a'
            drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp);
        }

        if (fIntro > 0) {
            // 4. Elementos estables (Focos)
            drawFoci(ctx, a, b, vp);

            const angActual = fTrazado * Math.PI * 2;
            const px = a * Math.cos(angActual);
            const py = b * Math.sin(angActual);
            // Distancia al foco derecho para la construcción e = PF / PD
            const distFoco = Math.sqrt((px - c)**2 + py**2); 

            // 5. Elipse (Trazado progresivo)
            if (fTrazado > 0) {
                ctx.save();
                ctx.strokeStyle = col.ellipse; 
                ctx.lineWidth   = col.strokeGrueso;
                ctx.lineCap     = "round";
                ctx.beginPath();
                for (let i = 0; i <= fTrazado + 0.005; i += 0.005) {
                    const ang = i * Math.PI * 2; 
                    ctx.lineTo(vp.X(a * Math.cos(ang)), vp.Y(b * Math.sin(ang)));
                }
                ctx.stroke();
                ctx.restore();
            }

            ctx.save();

            // 6. Directriz (Línea de puntos)
            ctx.strokeStyle = col.axis; 
            ctx.setLineDash([4 * (vp.dpr || 1), 4 * (vp.dpr || 1)]); 
            ctx.lineWidth   = col.strokeFino;
            ctx.globalAlpha = col.alphaTenue;

            ctx.beginPath();
            ctx.moveTo(vp.X(dX), vp.Y(-a * 2.2)); 
            ctx.lineTo(vp.X(dX), vp.Y(a * 2.2));
            ctx.stroke();

            if (fTrazado > 0) {
                ctx.setLineDash([]);

                // 7. Construcción del "Triángulo de Excentricidad"
                // Proyección a la directriz
                drawSegment(ctx, {x: px, y: py}, {x: dX, y: py}, col.axis, col.strokeFino, col.alphaTenue, vp);
                // Segmento vertical (ayuda visual para la etiqueta)
                drawSegment(ctx, {x: dX, y: py}, {x: dX, y: py - distFoco}, col.axis, col.strokeFino, col.alphaTenue, vp);
                // Radio vector (Foco a Punto)
                drawSegment(ctx, {x: c, y: 0}, {x: px, y: py}, col.foci, col.strokeFino, col.alphaMedio, vp);
                // Hipotenusa visual que representa la proporción
                drawSegment(ctx, {x: px, y: py}, {x: dX, y: py - distFoco}, col.barColor, col.barWidth, col.barAlpha, vp);

                // 8. Etiqueta (Reflejada para compensar el eje Y invertido de pantalla)
                const _tx = vp.X(dX) + 12 * (vp.dpr || 1);
                const _ty = vp.Y(py - distFoco/2);
                ctx.save();
                ctx.transform(1, 0, 0, -1, 0, 2 * _ty);
                ctx.fillStyle = col.barColor;
                ctx.font = `bold ${14 * (vp.dpr || 1)}px sans-serif`;
                ctx.textAlign = "left";
                ctx.fillText(`e = ${excentricidad.toFixed(2)}`, _tx, _ty);
                ctx.restore();

                // 9. Punto trazador
                drawPoint(ctx, px, py, col.ellipse, col.jointSize, true, 1, vp);
            }

            ctx.restore();
        }
    }

    // Registro con el nuevo nombre
    ElipseLab.registerMode('excentricidad', drawExcentricidad);
})();