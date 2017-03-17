import { types, util } from 'nmm-api';

import * as actions from './actions';

/**
 * reducer for changes to ephemeral session state
 */
const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setSource as any]: (state, payload) => {
      if (payload.pos !== undefined) {
        return util.setSafe(state, ['connection', 'source'], payload);
      } else if (payload.id === util.getSafe(state, ['connection', 'source', 'id'], undefined)) {
        return util.setSafe(state, ['connection', 'source'], undefined);
      } else {
        return state;
      }
    },
    [actions.setTarget as any]: (state, payload) => {
      if ((payload.pos !== undefined)
          && ((payload.id !== null)
              || (state.connection === undefined)
              || (state.connection.target === undefined)
              || (state.connection.target.id === undefined)
              || (state.connection.target.id === null))) {
        return util.setSafe(state, ['connection', 'target'], payload);
      } else if (payload.id === util.getSafe(state, ['connection', 'target', 'id'], undefined)) {
        return util.setSafe(state, ['connection', 'target'], undefined);
      } else {
        return state;
      }
    },
    [actions.setCreateRule as any]: (state, payload) =>
      util.setSafe(state, ['dialog'], payload),
    [actions.closeDialog as any]: (state, payload) =>
      util.setSafe(state, ['dialog'], undefined),
    [actions.setType as any]: (state, payload) =>
      util.setSafe(state, ['dialog', 'type'], payload),
  }, defaults: {
    connection: undefined,
    dialog: undefined,
  },
};

export default sessionReducer;
