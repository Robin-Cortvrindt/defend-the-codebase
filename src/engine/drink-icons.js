// Drink icons, seen from above: a can lid (White Monster, Red Bull) or a cup of coffee.
// Each draws centred on (0, 0), `size` px across. Works on the map canvas and on small DOM canvases.

const TAU = Math.PI * 2;

function circle(ctx, r, fill, stroke, width) {
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

// A can lid: coloured rim, lighter inner lid, a pull tab and the drinking hole. Drawn in 20-unit space.
export function drawCanLid(ctx, size, { rim, inner, edge, tab = '#94A3B8' }) {
  ctx.save();
  ctx.scale(size / 20, size / 20);
  circle(ctx, 9.3, rim, edge, 1.4);
  circle(ctx, 6.9, inner, edge, 0.8);
  // pull tab: a stadium shape with a hole in it
  ctx.beginPath();
  ctx.arc(0, -3.2, 3, Math.PI, 0);
  ctx.arc(0, 1.5, 3, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = tab; ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -3.2, 1.2, 0, TAU); ctx.fillStyle = inner; ctx.fill();
  // drinking hole
  ctx.beginPath(); ctx.ellipse(0, 4.3, 2.6, 1.3, 0, 0, TAU); ctx.fillStyle = edge; ctx.fill();
  ctx.restore();
}

// A cup of coffee from above: white rim, dark coffee and a little crema swirl.
export function drawCupTop(ctx, size) {
  ctx.save();
  ctx.scale(size / 20, size / 20);
  circle(ctx, 9.3, '#FFF7ED', '#7C2D12', 1.4);
  circle(ctx, 6.7, '#78350F');
  ctx.beginPath();
  ctx.arc(0, 2.6, 4.2, Math.PI * 1.2, Math.PI * 1.8);
  ctx.strokeStyle = '#D97706'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.stroke();
  ctx.restore();
}

// Draws a drink's icon centred on (0, 0). Drinks without `drawIcon` get a coloured disc with their `icon` text.
export function drawDrinkIcon(ctx, def, size) {
  if (def?.drawIcon) {
    ctx.save();
    try { def.drawIcon(ctx, size); } catch (e) { console.error(`[drink ${def.id}]`, e); }
    ctx.restore();
    return;
  }
  circle(ctx, size / 2, def?.color ?? '#64748B', '#FFFFFF', 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${Math.round(size * 0.55)}px Lato, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def?.icon ?? '', 0, 1);
}
