import { registerDrink } from '../../engine/registry.js';
import { drawCanLid } from '../../engine/drink-icons.js';

// The icon is a blue can lid seen from above; `icon` is the text fallback.
registerDrink({
  id: 'redbull', name: 'Red Bull', color: '#2563EB', icon: 'R',
  drawIcon: (ctx, size) => drawCanLid(ctx, size, { rim: '#2563EB', inner: '#BFDBFE', edge: '#1E3A8A' }),
});
