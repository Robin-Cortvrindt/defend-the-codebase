import { registerDrink } from '../../engine/registry.js';
import { drawCupTop } from '../../engine/drink-icons.js';

// The icon is a cup of coffee seen from above; `icon` is the text fallback.
registerDrink({ id: 'coffee', name: 'Coffee', color: '#92400E', icon: '☕', drawIcon: drawCupTop });
