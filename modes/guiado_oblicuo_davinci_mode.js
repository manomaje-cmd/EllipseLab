(function() {
    if (!window.ElipseLab) return;

    ElipseLab.registerMode('guiado_oblicuo_davinci', (ctx, state, helpers) => {

        const {
            viewport: vp, getColors, params,
            drawSegment, drawPoint, drawAxesExact, drawLabel,
            drawHandle, clamp01, easeInOutCubic, drawFoci
        } = helpers;

        const col = getColors();
        const { a, b } = params();
        const t = state.t || 0;

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
        // Quitamos la transición de t < 0.25 para que no estorbe.
        // Ahora SÓLO se dibujan si state.showAxes es true (el botón "Diámetros").
        if (state.showAxes) {
            ctx.save();
            drawAxesExact(ctx, a, b, vp);
            ctx.restore();
        }

        // El tirador rojo de 'a' lo dejamos SIEMPRE para poder cambiar el tamaño
        drawHandle(ctx, a, 0, "#ff0000", 'h', 1, vp);;

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

        // ─────────────────────────────────────────
        // 8) PUNTOS G, L, A Y B (Liberados)
        // ─────────────────────────────────────────
        // Quitamos el candado de fGiroProg
        const rHire = radioDiferencia / 2;
        
        // Calculamos P y centroHire independientemente del progreso si hace falta,
        // pero como ya están definidos arriba en el Bloque 3, se usarán sus valores actuales.
        
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
                const thalesCx = (P.x+centroHire.x)/2, thalesCy = (P.y+centroHire.y)/2;
                const thalesR  = Math.sqrt((P.x-centroHire.x)**2+(P.y-centroHire.y)**2)/2;
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

                // --- LÓGICA DE SNAP para Da Vinci ---
                const snapThreshold = 0.08;
                if (state._dvPhi1Dragged) {
                    if (Math.abs(state.phi_dv % (Math.PI / 2)) < snapThreshold || Math.abs((state.phi_dv % (Math.PI / 2)) - (Math.PI / 2)) < snapThreshold) {
                        state.phi_dv = Math.round(state.phi_dv / (Math.PI / 2)) * (Math.PI / 2);
                    }
                }
                if (state._dvPhi2Dragged) {
                    if (Math.abs(state.phi2_dv % (Math.PI / 2)) < snapThreshold || Math.abs((state.phi2_dv % (Math.PI / 2)) - (Math.PI / 2)) < snapThreshold) {
                        state.phi2_dv = Math.round(state.phi2_dv / (Math.PI / 2)) * (Math.PI / 2);
                    }
                }

                const A = state._dvPhi1Dragged ? lineCirclePos(state.phi_dv, centroHire.x, centroHire.y, rHire) : (tFeet[0] || null);
                const B = state._dvPhi2Dragged ? lineCirclePos(state.phi2_dv, centroHire.x, centroHire.y, rHire) : (tFeet[1] || null);

                     
                        
                // AQUÍ CALCULAMOS LOS SNAPS SIN REPETIR 'CONST'
                const snappedA = Math.abs((state.phi_dv || 0) % (Math.PI / 2)) < 0.001;
                const snappedB = Math.abs((state.phi2_dv || 0) % (Math.PI / 2)) < 0.001;
                
                const lenBlue = Math.abs(a - b)*5;

                // --- GUÍAS TÉCNICAS (Estilo Oblicuo Exterior) ---
                ctx.save();
                const grisTecnico = "#888888"; // Gris neutro profesional
                const lwTecnico = 1.2 * vp.dpr; // Trazo fino y preciso
                
                ctx.strokeStyle = grisTecnico;
                ctx.lineWidth = lwTecnico;
                ctx.globalAlpha = 1.0;
                ctx.setLineDash([]); // Línea continua, sin guiones
                
                [A, B].filter(Boolean).forEach(pt => {
                    const ang = Math.atan2(pt.y, pt.x);
                    ctx.beginPath();
                    // Dibujamos la guía que cruza todo el viewport
                    ctx.moveTo(vp.X(Math.cos(ang) * lenBlue), vp.Y(Math.sin(ang) * lenBlue));
                    ctx.lineTo(vp.X(-Math.cos(ang) * lenBlue), vp.Y(-Math.sin(ang) * lenBlue));
                    ctx.stroke();
                });
                ctx.restore();

                // ─────────────────────────────────────────
                // 2) EJES + TIRADORES
                // ─────────────────────────────────────────
                // Quitamos la transición de t < 0.25 para que no estorbe.
                // Ahora SÓLO se dibujan si state.showAxes es true (el botón "Diámetros").
                if (state.showAxes) {
                    ctx.save();
                    drawAxesExact(ctx, a, b, vp);
                    ctx.restore();
                }

                drawPoint(ctx, G.x, G.y, "#10b981", 4 * vp.dpr, true, 1, vp);
                drawPoint(ctx, L.x, L.y, "#3b82f6", 4 * vp.dpr, true, 1, vp);

                if (A && B) {
                    ctx.save();
                    // 1) EL RELLENO
                    ctx.globalAlpha = 0.15; 
                    ctx.fillStyle = "#2563eb"; 
                    ctx.beginPath();
                    ctx.moveTo(vp.X(P.x), vp.Y(P.y)); 
                    ctx.lineTo(vp.X(A.x), vp.Y(A.y)); 
                    ctx.lineTo(vp.X(B.x), vp.Y(B.y));
                    ctx.fill(); // Rellena el área cerrada
                    ctx.globalAlpha = 0.5;

                    // 2) EL CONTORNO
                    ctx.strokeStyle = "#2563eb";
                    ctx.beginPath();
                    // Empezamos en P
                    ctx.moveTo(vp.X(P.x), vp.Y(P.y));
                    // Tiramos la línea a A
                    ctx.lineTo(vp.X(A.x), vp.Y(A.y)); 
                    // Tiramos la línea a B
                    ctx.lineTo(vp.X(B.x), vp.Y(B.y));
                    // Y cerramos VOLVIENDO A P
                    ctx.lineTo(vp.X(P.x), vp.Y(P.y)); 
                    ctx.lineWidth = 3.0 * vp.dpr;
                    ctx.stroke(); // Dibuja la línea completa y cerrada
                    ctx.restore();
                }
                // --- DIBUJO DE PUNTOS Y ETIQUETAS ---
                if (A) {
                    const cA = (state._dvPhi1Dragged && snappedA) ? "#34d399" : "#ef4444";
                    drawPoint(ctx, A.x, A.y, cA, 4 * vp.dpr, false, 1, vp);
                    
                    
                }

                if (B) {
                    const cB = (state._dvPhi2Dragged && snappedB) ? "#34d399" : "#ef4444";
                    drawPoint(ctx, B.x, B.y, cB, 4 * vp.dpr, false, 1, vp);
                    
                  
                }

               // --- CIRCUNFERENCIA CORREGIDA (SIEMPRE TOCA B) ---
                if (A && B) {
                    ctx.save();
                    
                    // 1. Calculamos la posición de A y B en PÍXELES reales de la pantalla
                    const pixelAx = vp.X(A.x);
                    const pixelAy = vp.Y(A.y);
                    const pixelBx = vp.X(B.x);
                    const pixelBy = vp.Y(B.y);

                    // 2. Calculamos la distancia directamente en píxeles
                    const dx = pixelBx - pixelAx;
                    const dy = pixelBy - pixelAy;
                    const radioEnPixeles = Math.sqrt(dx * dx + dy * dy);

                    // 3. Estilo
                    ctx.strokeStyle = "#3a3a3a"; 
                    ctx.lineWidth = 1.5 * vp.dpr;
                    
                    ctx.globalAlpha = 0.6;

                    // 4. Dibujamos usando directamente los píxeles calculados
                    ctx.beginPath();
                    ctx.arc(pixelAx, pixelAy, radioEnPixeles, 0, Math.PI * 2);
                    ctx.stroke();
                    
                    ctx.restore();
                }
                
                // --- PUNTO B' (LA OTRA INTERSECCIÓN) ---
                let Bprime = null;
                if (A && B) {
                    const radioAB = Math.sqrt((B.x - A.x)**2 + (B.y - A.y)**2);
                    const anguloEjeB = Math.atan2(B.y, B.x);
                    const ux = Math.cos(anguloEjeB);
                    const uy = Math.sin(anguloEjeB);

                    const dot = A.x * ux + A.y * uy;
                    const projX = dot * ux;
                    const projY = dot * uy;
                    const distAProj = Math.sqrt((projX - A.x)**2 + (projY - A.y)**2);
                    
                    if (radioAB > distAProj) {
                        const dCorte = Math.sqrt(radioAB**2 - distAProj**2);
                        const distBalOrigen = Math.sqrt(B.x**2 + B.y**2);
                        const signoBprime = (distBalOrigen > dot) ? -1 : 1; 
                        
                        Bprime = {
                            x: projX + (signoBprime * dCorte) * ux,
                            y: projY + (signoBprime * dCorte) * uy
                        };

                        
                    }
                }

                // --- EL TRIÁNGULO ROJO (CLON RÍGIDO) ---
                if (A && B && Bprime) {
                    const dxAB = B.x - A.x;
                    const dyAB = B.y - A.y;
                    const angBaseAzul = Math.atan2(dyAB, dxAB);

                    const dxAP = P.x - A.x;
                    const dyAP = P.y - A.y;
                    const distAP = Math.sqrt(dxAP**2 + dyAP**2);
                    const angBrazoAzul = Math.atan2(dyAP, dxAP);

                    const aperturaInterna = angBrazoAzul - angBaseAzul;

                    const dxABp = Bprime.x - A.x;
                    const dyABp = Bprime.y - A.y;
                    const angBaseRoja = Math.atan2(dyABp, dxABp);

                    const Pprime = {
                        x: A.x + distAP * Math.cos(angBaseRoja + aperturaInterna),
                        y: A.y + distAP * Math.sin(angBaseRoja + aperturaInterna)
                    };

                    // --- EL TRIÁNGULO NARANJA (CLON RÍGIDO) ---
                    if (A && B && Bprime) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(vp.X(A.x), vp.Y(A.y));
                        ctx.lineTo(vp.X(Bprime.x), vp.Y(Bprime.y));
                        ctx.lineTo(vp.X(Pprime.x), vp.Y(Pprime.y));
                        ctx.closePath();
                        
                        // 1) RELLENO NARANJA ÁMBAR
                        ctx.globalAlpha = 0.15; 
                        ctx.fillStyle = "#f59e0b"; 
                        ctx.fill();
                        
                        // 2) CONTORNO NARANJA (Máxima visibilidad en colapso)
                        ctx.globalAlpha = 0.9; 
                        ctx.strokeStyle = "#f59e0b";
                        ctx.lineWidth = 3.0 * vp.dpr;
                        ctx.stroke(); 
                        
                        ctx.restore();
                    }
                    
                }

                // --- DIBUJO DE PUNTOS ARRASTRABLES (ESTILO ORIGINAL RECUPERADO) ---
                if (A) {
                    const cA = (state._dvPhi1Dragged && snappedA) ? "#34d399" : "#ef4444";
                    ctx.save();
                    ctx.globalAlpha = 0.9; ctx.strokeStyle = cA; ctx.lineWidth = 1.5 * vp.dpr;
                    ctx.setLineDash([3 * vp.dpr, 3 * vp.dpr]); ctx.beginPath();
                    ctx.arc(vp.X(A.x), vp.Y(A.y), 10 * vp.dpr, 0, Math.PI * 2);
                    ctx.stroke(); ctx.restore();
                    drawPoint(ctx, A.x, A.y, cA, 4 * vp.dpr, false, 1, vp);
                }
                if (B) {
                    const cB = (state._dvPhi2Dragged && snappedB) ? "#34d399" : "#ef4444";
                    ctx.save();
                    ctx.globalAlpha = 0.9; ctx.strokeStyle = cB; ctx.lineWidth = 1.5 * vp.dpr;
                    ctx.setLineDash([3 * vp.dpr, 3 * vp.dpr]); ctx.beginPath();
                    ctx.arc(vp.X(B.x), vp.Y(B.y), 10 * vp.dpr, 0, Math.PI * 2);
                    ctx.stroke(); ctx.restore();
                    drawPoint(ctx, B.x, B.y, cB, 4 * vp.dpr, false, 1, vp);
                }
            } // Cierra el if (dist > 0)
        
        if (state.showFoci) drawFoci(ctx, a, b, vp);
    });
})();