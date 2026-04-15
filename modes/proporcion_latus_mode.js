/**
 * Modo: proporcion_latus
 * * Visualización de la proporción a/b = b/l.
 * Incluye: circunferencia de radio b, bandas en 4 cuadrantes, focos
 * y puntos técnicos discretos (estilo guiado_ortogonal).
 */
(function () {
  if (!window.ElipseLab) return;

  ElipseLab.registerMode('proporcion_latus', (ctx, state, H) => {
    const {
      viewport: vp, getColors, params,
      drawSegment, drawPoint, drawAxesExact, drawHandle,
      drawEllipse, drawFoci, drawCircleWorld
    } = H;

    const col = getColors();
    const { a, b } = params();
    const dpr = vp.dpr || 1;
    
    // Parámetros geométricos
    const l = (b * b) / a;
    const c = Math.sqrt(Math.max(0, a * a - b * b));
    const jSize = (col.jointSize || 3.5) * dpr;
    const lw = 1 * dpr;

    // 1. Ejes y Elipse
    if (state.showAxes) drawAxesExact(ctx, a, b, vp);
    drawHandle(ctx, a, 0, '#ff0000', 'h', 1, vp);
    drawEllipse(ctx, a, b, col.ellipse, col.strokeGrueso, vp);

    // 2. Circunferencia de radio b (Referencia fundamental)
    // Usamos el color 'faint' y la opacidad tenue del sistema
    drawCircleWorld(ctx, 0, 0, b, col.faint, lw, col.alphaTenue || 0.3, vp);

    // 3. FOCOS
    if (state.showFoci) {
      drawFoci(ctx, a, b, vp);
    }

    // 4. Latus rectum (x = ±c)
    drawSegment(ctx, {x: c, y:-l}, {x: c, y: l}, col.axis, 1.5 * dpr, 0.7, vp);
    drawSegment(ctx, {x:-c, y:-l}, {x:-c, y: l}, col.axis, 1.5 * dpr, 0.7, vp);

    // 5. Bandas de relleno tenue
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = col.ellipse; 
    const dibujarBanda = (sx, sy) => {
      ctx.beginPath();
      ctx.moveTo(vp.X(a * sx), vp.Y(0));
      ctx.lineTo(vp.X(0),      vp.Y(b * sy));
      ctx.lineTo(vp.X(0),      vp.Y(l * sy));
      ctx.lineTo(vp.X(b * sx), vp.Y(0));
      ctx.closePath();
      ctx.fill();
    };
    [1, -1].forEach(sx => [1, -1].forEach(sy => dibujarBanda(sx, sy)));
    ctx.restore();

    // 6. Líneas de referencia (Eje Y -> Latus Rectum)
    ctx.save();
    ctx.strokeStyle = col.faint;
    ctx.lineWidth = dpr;
    ctx.globalAlpha = 0.8;
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.beginPath();
    ctx.moveTo(vp.X(-c), vp.Y(l));  ctx.lineTo(vp.X(c), vp.Y(l));
    ctx.moveTo(vp.X(-c), vp.Y(-l)); ctx.lineTo(vp.X(c), vp.Y(-l));
    ctx.stroke();
    ctx.restore();

    // 7. Puntos técnicos discretos
    const pCol = col.ellipse;
    drawPoint(ctx, 0, 0, pCol, jSize, true, 1, vp);
    
    [1, -1].forEach(s => {
        // Vértices y puntos de la proporción
        drawPoint(ctx, a * s, 0, pCol, jSize, true, 1, vp);
        drawPoint(ctx, 0, b * s, pCol, jSize, true, 1, vp);
        drawPoint(ctx, b * s, 0, pCol, jSize, true, 1, vp);
        drawPoint(ctx, 0, l * s, pCol, jSize, true, 1, vp);
        
        // Extremos Latus Rectum
        drawPoint(ctx, c * s,  l, pCol, jSize * 0.8, true, 0.8, vp);
        drawPoint(ctx, c * s, -l, pCol, jSize * 0.8, true, 0.8, vp);
    });
  });
})();