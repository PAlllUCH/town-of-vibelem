'use strict';
if (typeof module !== 'undefined' && module.exports) {
  require('./engine/00-namespace.js');
  require('./engine/01-roles.js');
  require('./engine/02-presets.js');
  require('./engine/03-deck.js');
  require('./engine/04-state.js');
  require('./engine/05-night-steps.js');
  require('./engine/06-night-actions.js');
  require('./engine/07-night-resolution.js');
  require('./engine/08-ghosts.js');
  require('./engine/09-day.js');
  require('./engine/10-victory.js');
  module.exports = globalThis.VillageEngine;
}
