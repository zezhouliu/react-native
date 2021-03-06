/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule findNodeHandle
 * @flow
 */

'use strict';

var ReactInstanceMap = require('ReactInstanceMap');
var {ReactCurrentOwner} = require('ReactGlobalSharedState');

var getComponentName = require('getComponentName');
var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

import type {Fiber} from 'ReactFiber';
import type {ReactInstance} from 'ReactInstanceType';

/**
 * ReactNative vs ReactWeb
 * -----------------------
 * React treats some pieces of data opaquely. This means that the information
 * is first class (it can be passed around), but cannot be inspected. This
 * allows us to build infrastructure that reasons about resources, without
 * making assumptions about the nature of those resources, and this allows that
 * infra to be shared across multiple platforms, where the resources are very
 * different. General infra (such as `ReactMultiChild`) reasons opaquely about
 * the data, but platform specific code (such as `ReactNativeBaseComponent`) can
 * make assumptions about the data.
 *
 *
 * `rootNodeID`, uniquely identifies a position in the generated native view
 * tree. Many layers of composite components (created with `React.createClass`)
 * can all share the same `rootNodeID`.
 *
 * `nodeHandle`: A sufficiently unambiguous way to refer to a lower level
 * resource (dom node, native view etc). The `rootNodeID` is sufficient for web
 * `nodeHandle`s, because the position in a tree is always enough to uniquely
 * identify a DOM node (we never have nodes in some bank outside of the
 * document). The same would be true for `ReactNative`, but we must maintain a
 * mapping that we can send efficiently serializable
 * strings across native boundaries.
 *
 * Opaque name      TodaysWebReact   FutureWebWorkerReact   ReactNative
 * ----------------------------------------------------------------------------
 * nodeHandle       N/A              rootNodeID             tag
 */

let injectedFindNode;
let injectedFindRootNodeID;

// TODO (bvaughn) Rename the findNodeHandle module to something more descriptive
// eg findInternalHostInstance. This will reduce the likelihood of someone
// accidentally deep-requiring this version.
function findNodeHandle(componentOrHandle: any): any {
  if (__DEV__) {
    var owner =
      ((ReactCurrentOwner.current: any): ReactInstance | Fiber | null);
    if (owner !== null) {
      const isFiber = typeof (owner: any).tag === 'number';
      const warnedAboutRefsInRender = isFiber
        ? ((owner: any): Fiber).stateNode._warnedAboutRefsInRender
        : ((owner: any): ReactInstance)._warnedAboutRefsInRender;

      warning(
        warnedAboutRefsInRender,
        '%s is accessing findNodeHandle inside its render(). ' +
          'render() should be a pure function of props and state. It should ' +
          'never access something that requires stale data from the previous ' +
          'render, such as refs. Move this logic to componentDidMount and ' +
          'componentDidUpdate instead.',
        getComponentName(owner) || 'A component',
      );

      if (isFiber) {
        ((owner: any): Fiber).stateNode._warnedAboutRefsInRender = true;
      } else {
        ((owner: any): ReactInstance)._warnedAboutRefsInRender = true;
      }
    }
  }
  if (componentOrHandle == null) {
    return null;
  }
  if (typeof componentOrHandle === 'number') {
    // Already a node handle
    return componentOrHandle;
  }

  var component = componentOrHandle;

  // TODO (balpert): Wrap iOS native components in a composite wrapper, then
  // ReactInstanceMap.get here will always succeed for mounted components
  var internalInstance = ReactInstanceMap.get(component);
  if (internalInstance) {
    return injectedFindNode(internalInstance);
  } else {
    var rootNodeID = injectedFindRootNodeID(component);
    if (rootNodeID) {
      return rootNodeID;
    } else {
      invariant(
        // Native
        (typeof component === 'object' &&
          ('_rootNodeID' in component || // TODO (bvaughn) Clean up once Stack is deprecated
            '_nativeTag' in component)) ||
          // Composite
          (component.render != null && typeof component.render === 'function'),
        'findNodeHandle(...): Argument is not a component ' +
          '(type: %s, keys: %s)',
        typeof component,
        Object.keys(component),
      );
      invariant(
        false,
        'findNodeHandle(...): Unable to find node handle for unmounted ' +
          'component.',
      );
    }
  }
}

// Fiber and stack implementations differ; each must inject a strategy
findNodeHandle.injection = {
  injectFindNode(findNode) {
    injectedFindNode = findNode;
  },
  injectFindRootNodeID(findRootNodeID) {
    injectedFindRootNodeID = findRootNodeID;
  },
};

module.exports = findNodeHandle;
