/**
 * Modo: Osculatriz (Versión Modernizada ES6 - Fiel al original)
 */
(function () {
    if (!window.ElipseLab) return;

    window.ElipseLab.registerMode('osculatriz', (ctx, state, H) => {
        const { viewport: vp, getColors, params, clamp01, drawAxesExact, drawHandle, drawPoint, drawLabel, drawFoci, drawSegment } = H;
        const col = getColors();
        const { a, b } = params();
        const t = state.t || 0;
        const jSize = col.jointSize || (3.5 * vp.dpr);

        const c2 = Math.max(0, a * a - b * b);
        const Ax = c2 / a;   // semieje X de la astroide
        const Ay = c2 / b;   // semieje Y de la astroide

        // ── Cronología ────────────────────────────────────────────────────
        const fTravel = clamp01((t - 0.25) / 0.75);
        const theta = fTravel * 2 * Math.PI;
        const fShow = clamp01((t - 0.25) / 0.12);

        if (t < 0.26) state.offsetNormal = undefined;

        // ── Helpers geométricos ───────────────────────────────────────────
        const oscCenter = (th) => ({
            x:  Ax * Math.pow(Math.cos(th), 3),
            y: -Ay * Math.pow(Math.sin(th), 3)
        });
        const oscRadius = (th) => {
            const s = Math.sin(th), co = Math.cos(th);
            return Math.pow(a * a * s * s + b * b * co * co, 1.5) / (a * b);
        };
        const ellipsePoint = (th) => ({ x: a * Math.cos(th), y: b * Math.sin(th) });

        // ── Ejes ──────────────────────────────────────────────────────────
        if (t >= 0.25 && state.showAxes) {
            ctx.save();
            ctx.globalAlpha = 0.35 * fShow;
            drawAxesExact(ctx, a, b, vp);
            ctx.restore();
        }
        drawHandle(ctx, a, 0, '#ff0000', 'h', 1, vp);

        // ── Elipse (trazo progresivo) ─────────────────────────────────────
        if (fTravel > 0) {
            const steps_el = Math.max(1, Math.round(360 * fTravel));
            ctx.save();
            ctx.strokeStyle = col.ellipse;
            ctx.lineWidth = col.strokeGrueso || (2 * vp.dpr);
            ctx.globalAlpha = 0.95 * fShow;
            ctx.lineJoin = ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i <= steps_el; i++) {
                const Pi = ellipsePoint(i * 2 * Math.PI / 360);
                i === 0 ? ctx.moveTo(vp.X(Pi.x), vp.Y(Pi.y)) : ctx.lineTo(vp.X(Pi.x), vp.Y(Pi.y));
            }
            ctx.stroke();
            ctx.restore();
        }

        // ── Evoluta (astroide) ────────────────────────────────────────────
        if (fTravel > 0) {
            const steps_evo = Math.max(1, Math.round(360 * fTravel));
            ctx.save();
            ctx.strokeStyle = col.circs || '#888';
            ctx.lineWidth = (col.strokeMedio || 1.5) * vp.dpr;
            ctx.globalAlpha = 0.70 * fShow;
            ctx.lineJoin = ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i <= steps_evo; i++) {
                const Ci = oscCenter(i * 2 * Math.PI / 360);
                i === 0 ? ctx.moveTo(vp.X(Ci.x), vp.Y(Ci.y)) : ctx.lineTo(vp.X(Ci.x), vp.Y(Ci.y));
            }
            ctx.stroke();
            ctx.restore();

            const cusp = [{ x: Ax, y: 0 }, { x: -Ax, y: 0 }, { x: 0, y: Ay }, { x: 0, y: -Ay }];
            cusp.forEach(p => drawPoint(ctx, p.x, p.y, col.circs || '#888', jSize * 0.8, true, 0.35 * fShow, vp));
        }

        // ── Osculatriz viajera ────────────────────────────────────────────
        const P = (fTravel > 0) ? ellipsePoint(theta) : { x: a, y: 0 };
        if (fTravel > 0) {
            const C = oscCenter(theta);
            const R = oscRadius(theta);

            ctx.save();
            ctx.strokeStyle = col.barColor || '#c2410c';
            ctx.lineWidth = (col.strokeMedio || 1.5) * vp.dpr;
            ctx.globalAlpha = 0.85 * fShow;
            ctx.beginPath();
            ctx.arc(vp.X(C.x), vp.Y(C.y), R * vp.scale * vp.userZoom, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            drawPoint(ctx, P.x, P.y, col.ellipse, jSize * 1.5, true, fShow, vp);
            drawPoint(ctx, C.x, C.y, col.barColor || '#c2410c', jSize, true, fShow, vp);

            if (drawLabel) {
                const Rmin = b * b / a, Rmax = a * a / b;
                drawLabel(ctx, vp.X(0), vp.Y(-b * 0.88),
                    `R = ${R.toFixed(1)}   (mín ${Rmin.toFixed(1)} · máx ${Rmax.toFixed(1)})`,
                    { size: 11, color: col.barColor || '#c2410c', alpha: 0.85 * fShow }, vp);
            }
        }

        // ── NORMAL + PUNTO TRAZADOR ───────────────────────────────────────
        if (fTravel > 0) {
            const normalColor = "#ff00ff";
            const cosT = Math.cos(theta), sinT = Math.sin(theta);
            const nxRaw = b * cosT, nyRaw = a * sinT;
            const nDist = Math.sqrt(nxRaw * nxRaw + nyRaw * nyRaw);

            if (nDist > 1e-9) {
                const ux = nxRaw / nDist, uy = nyRaw / nDist;
                const extAux = Math.max(a, b) * 2.2;
                if (state.offsetNormal === undefined) state.offsetNormal = -(b * b) / a;
                const off = state.offsetNormal;

                // 1) Línea normal
                ctx.save();
                ctx.strokeStyle = normalColor;
                ctx.lineWidth = vp.dpr * 1.2;
                ctx.globalAlpha = 0.75 * fShow;
                ctx.beginPath();
                ctx.moveTo(vp.X(P.x - ux * extAux), vp.Y(P.y - uy * extAux));
                ctx.lineTo(vp.X(P.x + ux * extAux), vp.Y(P.y + uy * extAux));
                ctx.stroke();
                ctx.restore();

                // Etiqueta "n"
                const perpX = -uy, perpY = ux;
                const labelOffset = ((b * b) / a) * 0.55;
                const sideOffset = 12 / (vp.scale * vp.userZoom);
                drawLabel(ctx, 
                    vp.X(P.x - ux * labelOffset + perpX * sideOffset),
                    vp.Y(P.y - uy * labelOffset + perpY * sideOffset),
                    "n", { align: "center", baseline: "middle", size: 13, bold: true, color: normalColor }, vp);

                // 2) Punto trazador
                const Tr = { x: P.x + ux * off, y: P.y + uy * off };
                const snapTolDraw = 0.5 / (vp.scale * vp.userZoom);
                const isSnapped = [-(b*b)/a, -(a*a)/b, (b*b)/a, (a*a)/b].some(sp => Math.abs(off - sp) < snapTolDraw);
                const tracerColor = isSnapped ? "#34d399" : normalColor;

                ctx.save();
                ctx.strokeStyle = ctx.fillStyle = tracerColor;
                ctx.globalAlpha = 0.9; ctx.lineWidth = 1.5 * vp.dpr;
                ctx.beginPath(); ctx.arc(vp.X(Tr.x), vp.Y(Tr.y), 5 * vp.dpr, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 0.45;
                ctx.beginPath(); ctx.arc(vp.X(Tr.x), vp.Y(Tr.y), 10 * vp.dpr, 0, Math.PI * 2); ctx.stroke();
                ctx.restore();
            }
        }

        // ── CURVA PARALELA ───────────────────────────────────────────────
        if (fTravel > 0 && state.offsetNormal !== undefined) {
            const off2 = state.offsetNormal;
            ctx.save();
            ctx.strokeStyle = "#ff00ff";
            ctx.globalAlpha = 0.45 * fShow;
            ctx.lineWidth = vp.dpr;
            ctx.lineJoin = "round";
            ctx.beginPath();
            let started = false;
            const steps_par = Math.max(1, Math.round(360 * fTravel));
            for (let i = 0; i <= steps_par; i++) {
                const ang = (i / 180) * Math.PI;
                const nx = b * Math.cos(ang), ny = a * Math.sin(ang);
                const nd = Math.sqrt(nx * nx + ny * ny);
                if (nd < 1e-9) continue;
                const ex = (a * Math.cos(ang)) + (nx / nd) * off2;
                const ey = (b * Math.sin(ang)) + (ny / nd) * off2;
                if (!started) { ctx.moveTo(vp.X(ex), vp.Y(ey)); started = true; }
                else ctx.lineTo(vp.X(ex), vp.Y(ey));
            }
            ctx.stroke();
            ctx.restore();
        }

        if (state.showFoci) drawFoci(ctx, a, b, vp);
    });
})();