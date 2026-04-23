(function() {
    if (!window.ElipseLab) return;

    ElipseLab.registerMode('hipotrocoide2', (ctx, state, helpers) => {

        const {
            viewport: vp, getColors, params,
            drawSegment, drawPoint, drawAxesExact, drawLabel,
            drawHandle, clamp01, easeInOutCubic, drawFoci
        } = helpers;

        const col = getColors();
        const { a, b } = params();
        const t = state.t || 0;

        const colHipo = "#a855f7"; // Un púrpura vibrante (estilo moderno)
        const colHipoFill = "rgba(168, 85, 247, 0.15)"; // El mismo pero con transparencia para el relleno

        // ─────────────────────────────────────────
        // 0) CONSTANTES MECÁNICAS
        // ─────────────────────────────────────────
        const vCol   = col.barColor   || "#c2410c";
        const vAlpha = col.barAlpha   || 0.90;
        const vWidth = col.barWidth   || (2.5 * vp.dpr);
        const jSize  = col.jointSize  || (3.5 * vp.dpr);

        // ─────────────────────────────────────────
        // 1) CRONOLOGÍA
        // ─────────────────────────────────────────
        const fCircIntro = clamp01(t * 20); 
        const fCircMov   = easeInOutCubic(clamp01((t - 0.05) / 0.10)); 
        const fVaraFade  = clamp01((t - 0.15) * 15); 
        const fAuxFade   = clamp01((t - 0.20) * 15); 
        const fGiroProg  = clamp01((t - 0.25) / 0.75);
        const fCircOut   = clamp01(1 - (t - 0.25) * 10); 

        // ─────────────────────────────────────────
        // 2) EJES + TIRADORES
        // ─────────────────────────────────────────
        const fEjes = t < 0.25 ? clamp01(1 - t / 0.25) : (state.showAxes ? 1 : 0);
        if (fEjes > 0) {
            ctx.save();
            ctx.globalAlpha = fEjes;
            drawAxesExact(ctx, a, b, vp);
            ctx.restore();
        }

        drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp);

        // ─────────────────────────────────────────
        // 3) CINEMÁTICA DEL MECANISMO
        // ─────────────────────────────────────────
        const theta = fGiroProg * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const P = { x: a * cosT, y: b * sinT };
        const M = { x: (a - b) * cosT, y: 0 };
        const Q = { x: 0, y: (b - a) * sinT };

        const radioDiferencia = Math.abs(a - b);
        const centroHire = {
            x: (M.x + Q.x) / 2,
            y: (M.y + Q.y) / 2
        };

        // ─────────────────────────────────────────
        // 4) VARA MECÁNICA
        // ─────────────────────────────────────────
        if (fVaraFade > 0) {
            drawSegment(ctx, Q, P, vCol, vWidth, fVaraFade * vAlpha, vp);
            drawPoint(ctx, M.x, M.y, vCol, jSize, false, fVaraFade, vp);
            drawPoint(ctx, Q.x, Q.y, col.ellipse, jSize, false, fVaraFade, vp);
        }

        // ─────────────────────────────────────────
        // 5) CÍRCULOS AUXILIARES
        // ─────────────────────────────────────────
        if (fAuxFade > 0) {
            ctx.save();
            ctx.lineWidth = vp.dpr;
            ctx.strokeStyle = col.circs;
            ctx.globalAlpha = fAuxFade;

            // Círculo base
            ctx.beginPath();
            ctx.arc(vp.X(0), vp.Y(0), radioDiferencia * vp.scale * vp.userZoom, 0, Math.PI * 2);
            ctx.stroke();

            // Círculo de Hire
            ctx.beginPath();
            ctx.arc(
                vp.X(centroHire.x), vp.Y(centroHire.y),
                (radioDiferencia / 2) * vp.scale * vp.userZoom,
                0, Math.PI * 2
            );
            ctx.stroke();
            ctx.restore();
        }

        // ─────────────────────────────────────────
        // 5.5) NUEVA CIRCUNFERENCIA (t = 0.25)
        // Radio 0.5*(a+b), centrada entre Hire y P
        // ─────────────────────────────────────────
        if (fCircOut > 0 && t >= 0.20) {
            ctx.save();
            // Punto medio entre el centro de Hire y el centro del círculo de radio b (P)
            const centroMid = {
                x: (centroHire.x + P.x) / 2,
                y: (centroHire.y + P.y) / 2
            };
            const radioSumaHalf = 0.25 * (Math.abs(a) + Math.abs(b));
            
            ctx.globalAlpha = fCircOut * 0.5; // Desvanece al empezar el giro
            ctx.strokeStyle = col.circs;
            ctx.setLineDash([5 * vp.dpr, 5 * vp.dpr]);
            ctx.lineWidth = vp.dpr;
            ctx.beginPath();
            ctx.arc(
                vp.X(centroMid.x), vp.Y(centroMid.y),
                radioSumaHalf * vp.scale * vp.userZoom,
                0, Math.PI * 2
            );
            ctx.stroke();
            ctx.restore();
        }

        // ─────────────────────────────────────────
        // 6) CÍRCULO INTRODUCTORIO (Radio b)
        // ─────────────────────────────────────────
        if (fCircIntro > 0 && fCircOut > 0) {
            ctx.save();
            const centroX = (fGiroProg > 0) ? P.x : a * fCircMov;
            const centroY = (fGiroProg > 0) ? P.y : 0;
            ctx.globalAlpha = fCircIntro * fCircOut;
            ctx.strokeStyle = col.circs;
            ctx.lineWidth   = vp.dpr;
            ctx.beginPath();
            ctx.arc(vp.X(centroX), vp.Y(centroY), Math.abs(b) * vp.scale * vp.userZoom, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        if (t < 0.26) {
            state._tira_phi2_ready = false;
            state._hipoPhi1Dragged = false;
            state._hipoPhi2Dragged = false;
        }

       // ─────────────────────────────────────────
        // 6.5) NORMAL (Sincronizada con Jardinero y Osculatriz)
        // ─────────────────────────────────────────
        if (fGiroProg > 0) {
            const normalColor = "#ff00ff";
            // Usamos las mismas bases: b*cosT y a*sinT
            const nxRaw = b * cosT, nyRaw = a * sinT;
            const nDist = Math.sqrt(nxRaw * nxRaw + nyRaw * nyRaw);

            if (nDist > 1e-9) {
                const ux = nxRaw / nDist, uy = nyRaw / nDist;
                
                // La longitud maestra: 1.5 * a
                const largo = a * 1.5; 

                // Mismos puntos que en Jardinero: P2 entra (largo), P1_ext asoma (largo/4)
                const P2 = { x: P.x - ux * largo, y: P.y - uy * largo };
                const P1_ext = { x: P.x + ux * (largo / 4), y: P.y + uy * (largo / 4) };

                ctx.save();
                // MISMO ESTILO EXACTO: Trazo y punto [12, 4, 2, 4]
                ctx.setLineDash([12, 4, 2, 4]); 
                ctx.lineCap = "round"; 
                ctx.strokeStyle = normalColor;
                ctx.lineWidth = vp.dpr * 1.2;
                ctx.globalAlpha = 0.75;

                ctx.beginPath();
                ctx.moveTo(vp.X(P1_ext.x), vp.Y(P1_ext.y));
                ctx.lineTo(vp.X(P2.x), vp.Y(P2.y));
                ctx.stroke();
                ctx.restore();

                // Etiqueta "n" posicionada igual
                const labelOffset = (b * b / a) * 0.55;
                const perpX = -uy, perpY = ux;
                const sideOffset = 12 / (vp.scale * vp.userZoom);
                drawLabel(ctx,
                    vp.X(P.x - ux * labelOffset + perpX * sideOffset),
                    vp.Y(P.y - uy * labelOffset + perpY * sideOffset),
                    "n", { align: "center", baseline: "middle", size: 13, bold: true, color: normalColor }, vp);
            }
        }
        

        // ─────────────────────────────────────────
        // 7) ELIPSE
        // ─────────────────────────────────────────
        if (fGiroProg > 0) {
            ctx.save();
            ctx.strokeStyle = col.ellipse;
            ctx.lineWidth   = col.strokeGrueso;
            ctx.lineJoin    = "round";
            ctx.beginPath();
            for (let i = 0; i <= 180 * fGiroProg; i++) {
                const ang = (i / 90) * Math.PI;
                ctx.lineTo(vp.X(a * Math.cos(ang)), vp.Y(b * Math.sin(ang)));
            }
            ctx.stroke();
            ctx.restore();
            drawPoint(ctx, P.x, P.y, col.ellipse, jSize * 1.6, true, 1, vp);
        }

        /// ─────────────────────────────────────────
        // 8) PUNTOS G, L, A Y B
        // ─────────────────────────────────────────
        if (fGiroProg > 0) {
            const rHire = radioDiferencia / 2;
            const dx = P.x - centroHire.x;
            const dy = P.y - centroHire.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            const G = { x: centroHire.x + (dx/dist)*rHire, y: centroHire.y + (dy/dist)*rHire };
            const L = { x: centroHire.x - (dx/dist)*rHire, y: centroHire.y - (dy/dist)*rHire };

            function circleIntersections(cx1, cy1, r1, cx2, cy2, r2) {
                const ddx = cx2-cx1, ddy = cy2-cy1, d = Math.sqrt(ddx*ddx+ddy*ddy);
                if (d > r1+r2+1e-9 || d < Math.abs(r1-r2)-1e-9 || d < 1e-9) return [];
                const a2 = (r1*r1 - r2*r2 + d*d)/(2*d);
                const h = Math.sqrt(Math.max(0, r1*r1 - a2*a2));
                const mx = cx1 + a2*ddx/d, my = cy1 + a2*ddy/d;
                if (h < 1e-9) return [{x:mx,y:my}];
                return [{x:mx+h*ddy/d, y:my-h*ddx/d},{x:mx-h*ddy/d, y:my+h*ddx/d}];
            }

            const thalesCx = (P.x + centroHire.x) / 2, thalesCy = (P.y + centroHire.y) / 2;
            const thalesR  = Math.sqrt((P.x - centroHire.x)**2 + (P.y - centroHire.y)**2) / 2;
            const tFeet = circleIntersections(centroHire.x, centroHire.y, rHire, thalesCx, thalesCy, thalesR);

            function lineCirclePos(ang, cx, cy, r) {
                const ca = Math.cos(ang), sa = Math.sin(ang);
                const bC = -2 * (ca * cx + sa * cy);
                const cC = cx*cx + cy*cy - r*r;
                const d = bC*bC - 4*cC;
                if (d < 0) return null;
                const tVal = (Math.abs((-bC + Math.sqrt(d))/2) > Math.abs((-bC - Math.sqrt(d))/2)) ? (-bC + Math.sqrt(d))/2 : (-bC - Math.sqrt(d))/2;
                return { x: tVal * ca, y: tVal * sa };
            }

            // --- LÓGICA DE SNAP A LAS TANGENCIAS ---
            const phiTanA = (tFeet[0]) ? Math.atan2(tFeet[0].y, tFeet[0].x) : null;
            const phiTanB = (tFeet[1]) ? Math.atan2(tFeet[1].y, tFeet[1].x) : null;
            const snapThreshold = 0.12; 

            if (state._hipoPhi1Dragged && phiTanA !== null) {
                if (Math.abs(state.phi_hipo - phiTanA) < snapThreshold || Math.abs(Math.abs(state.phi_hipo - phiTanA) - Math.PI * 2) < snapThreshold) {
                    state.phi_hipo = phiTanA;
                }
            }
            if (state._hipoPhi2Dragged && phiTanB !== null) {
                if (Math.abs(state.phi2_hipo - phiTanB) < snapThreshold || Math.abs(Math.abs(state.phi2_hipo - phiTanB) - Math.PI * 2) < snapThreshold) {
                    state.phi2_hipo = phiTanB;
                }
            }

            const A = state._hipoPhi1Dragged ? lineCirclePos(state.phi_hipo, centroHire.x, centroHire.y, rHire) : (tFeet[0] || null);
            const B = state._hipoPhi2Dragged ? lineCirclePos(state.phi2_hipo, centroHire.x, centroHire.y, rHire) : (tFeet[1] || null);
            
            // Verificamos si están en posición de snap (margen de error mínimo para el color)
            const snappedA = A && phiTanA !== null && Math.abs(state.phi_hipo - phiTanA) < 0.001;
            const snappedB = B && phiTanB !== null && Math.abs(state.phi2_hipo - phiTanB) < 0.001;
            
            const lenBlue = Math.abs(a - b);

            // Líneas de G y L
            ctx.save();
            ctx.strokeStyle = col.circs; ctx.globalAlpha = 0.9; ctx.lineWidth = vp.dpr;
            [G, L].forEach(pt => {
                const ang = Math.atan2(pt.y, pt.x);
                ctx.beginPath();
                ctx.moveTo(vp.X(Math.cos(ang) * radioDiferencia), vp.Y(Math.sin(ang) * radioDiferencia));
                ctx.lineTo(vp.X(-Math.cos(ang) * radioDiferencia), vp.Y(-Math.sin(ang) * radioDiferencia));
                ctx.stroke();
            });
            ctx.restore();

            // Líneas de A y B
            ctx.save();
            ctx.strokeStyle = "rgba(168, 85, 247, 0.25)"; ctx.lineWidth = vp.dpr*5;
            [A, B].filter(Boolean).forEach(pt => {
                const ang = Math.atan2(pt.y, pt.x);
                ctx.beginPath();
                ctx.moveTo(vp.X(Math.cos(ang) * lenBlue), vp.Y(Math.sin(ang) * lenBlue));
                ctx.lineTo(vp.X(-Math.cos(ang) * lenBlue), vp.Y(-Math.sin(ang) * lenBlue));
                ctx.stroke();
            });
            ctx.restore();

            drawPoint(ctx, G.x, G.y, "#10b981", 4 * vp.dpr, true, 1, vp);
            drawPoint(ctx, L.x, L.y, "#3b82f6", 4 * vp.dpr, true, 1, vp);

            // --- DIBUJO DEL TRIÁNGULO PÚRPURA ---
            if (A && B) {
                ctx.save();
                ctx.fillStyle = colHipoFill; 
                ctx.beginPath();
                ctx.moveTo(vp.X(P.x), vp.Y(P.y));
                ctx.lineTo(vp.X(A.x), vp.Y(A.y));
                ctx.lineTo(vp.X(B.x), vp.Y(B.y));
                ctx.fill();
                ctx.strokeStyle = colHipo;
                ctx.lineWidth = 1 * vp.dpr;
                ctx.globalAlpha = 0.5;
                ctx.stroke(); 
                ctx.restore();
            }

            // DIBUJO DE PUNTOS (Verde si hay snap, Rojo en cualquier otro caso)
            if (A) {
                const cA = snappedA ? "#34d399" : "#ef4444";
                ctx.save();
                ctx.globalAlpha = 0.9; ctx.strokeStyle = cA; ctx.lineWidth = 1.5 * vp.dpr;
                ctx.setLineDash([3 * vp.dpr, 3 * vp.dpr]); ctx.beginPath();
                ctx.arc(vp.X(A.x), vp.Y(A.y), 10 * vp.dpr, 0, Math.PI * 2);
                ctx.stroke(); ctx.restore();
                drawPoint(ctx, A.x, A.y, cA, 4 * vp.dpr, false, 1, vp);
            }
            if (B) {
                const cB = snappedB ? "#34d399" : "#ef4444";
                ctx.save();
                ctx.globalAlpha = 0.9; ctx.strokeStyle = cB; ctx.lineWidth = 1.5 * vp.dpr;
                ctx.setLineDash([3 * vp.dpr, 3 * vp.dpr]); ctx.beginPath();
                ctx.arc(vp.X(B.x), vp.Y(B.y), 10 * vp.dpr, 0, Math.PI * 2);
                ctx.stroke(); ctx.restore();
                drawPoint(ctx, B.x, B.y, cB, 4 * vp.dpr, false, 1, vp);
            }
        }
        }
        // --- BLOQUE DE FOCOS ---
    if (state.showFoci) {
      drawFoci(ctx, a, b, vp);
    }
    // -----------------------
    });
})();
