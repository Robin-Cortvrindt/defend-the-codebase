import { registerDrink } from '../../engine/registry.js';
import { drawCanLid } from '../../engine/drink-icons.js';

// The icon is a white can lid seen from above; `icon` is the text fallback.
registerDrink({
  id: 'monster', name: 'White Monster', color: '#64748B', icon: 'M',
  drawIcon: (ctx, size) => drawCanLid(ctx, size, { rim: '#F8FAFC', inner: '#CBD5E1', edge: '#334155' }),
});
