/* @flow */

import type VueRouter from './index'
import { resolvePath } from './util/path'
import { assert, warn } from './util/warn'
import { createRoute } from './util/route'
import { fillParams } from './util/params'
import { createRouteMap } from './create-route-map'
import { normalizeLocation } from './util/location'

export type Matcher = {
  match: (raw: RawLocation, current?: Route, redirectedFrom?: Location) => Route;
  addRoutes: (routes: Array<RouteConfig>) => void;
};

export function createMatcher (
  routes: Array<RouteConfig>,
  router: VueRouter
): Matcher {
  // 这里拿从routes抽取成3个集合
  // pathList:[path]
  // pathMap:{path:recorf}
  const { pathList, pathMap, nameMap } = createRouteMap(routes)

  function addRoutes (routes) {
    createRouteMap(routes, pathList, pathMap, nameMap)
  }

  function match (
    raw: RawLocation,
    currentRoute?: Route,
    redirectedFrom?: Location
  ): Route {
    // 标准化rawLocation
    const location = normalizeLocation(raw, currentRoute, false, router)
    // 拿到标准化后的location的name属性

    // 拿到location中的name的属性
    const { name } = location

    // 如果name属性存在
    if (name) {
      // 在nameMap中通过name取到record
      const record = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        warn(record, `Route with name '${name}' does not exist`)
      }
      // 如果record不存在就createRoute,函数执行完毕
      if (!record) return _createRoute(null, location)
      // 运行到这里表示record存在
      // 拿到paramNames
      const paramNames = record.regex.keys
        .filter(key => !key.optional)
        .map(key => key.name)

      // 如果params不是对象
      // 将location.params设置为对象
      if (typeof location.params !== 'object') {
        location.params = {}
      }

      // 如果currentRoute.params是对象
      if (currentRoute && typeof currentRoute.params === 'object') {
        // 遍历这个params的键
        for (const key in currentRoute.params) {
          // 如果这个key在location.params中不存在
          // 但是在paramNames中存在
          if (!(key in location.params) && paramNames.indexOf(key) > -1) {
            // currentRoute.params中的对应的值赋给location.params[key]
            location.params[key] = currentRoute.params[key]
          }
        }
      }
      // 如果record存在
      if (record) {
        // 运行fillParams
        // 然后创建Route
        location.path = fillParams(record.path, location.params, `named route "${name}"`)
        return _createRoute(record, location, redirectedFrom)
      }
    } else if (location.path) {
      // 如果location.path存在
      // location.params ={} 先初始化一个对象
      // 然后遍历pathList
      // 如果匹配到了就创建Route
      location.params = {}
      for (let i = 0; i < pathList.length; i++) {
        const path = pathList[i]
        const record = pathMap[path]
        // 遍历pathList中的每个path
        // 然后执行matchRoute,取出每个pathMap中对应path的record
        // record中存有regex,components,instances
        if (matchRoute(record.regex, location.path, location.params)) {
          return _createRoute(record, location, redirectedFrom)
        }
      }
    }
    // 运行到这里表示并没有匹配成功
    // 直接创建route
    // no match
    return _createRoute(null, location)
  }

  // 重定向
  function redirect (
    record: RouteRecord,
    location: Location
  ): Route {
    // 拿到record的redirect属性
    const originalRedirect = record.redirect
    // 如果redirect是函数
    let redirect = typeof originalRedirect === 'function'
        ? originalRedirect(createRoute(record, location, null, router))
        : originalRedirect
    // 如果redirect是字符串
    // 就将redirect包装成一个对象,这个对象有一个值为redirect的path属性
    if (typeof redirect === 'string') {
      redirect = { path: redirect }
    }

    // 如果没有redirect或者redirect不是对象
    // 报个错,然后返回
    if (!redirect || typeof redirect !== 'object') {
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false, `invalid redirect option: ${JSON.stringify(redirect)}`
        )
      }
      return _createRoute(null, location)
    }

    // redirect现在已经是对象了
    const re: Object = redirect
    // 拿到name和path属性
    const { name, path } = re
    // 拿到location的query,hash,params3个属性
    let { query, hash, params } = location
    // 如果redirect存在query就用redirect的否则用location的
    query = re.hasOwnProperty('query') ? re.query : query
    // 如果redirect存在hash就用redirect的否则用location的
    hash = re.hasOwnProperty('hash') ? re.hash : hash
    // 如果redirect存在params就用redirect的否则用location的
    params = re.hasOwnProperty('params') ? re.params : params

    if (name) {
      // resolved named direct
      // 如果name存在
      // 现在nameMap中通过name拿到record
      const targetRecord = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        assert(targetRecord, `redirect failed: named route "${name}" not found.`)
      }
      // 通过运行match来匹配
      // 返回结果
      return match({
        _normalized: true,
        name,
        query,
        hash,
        params
      }, undefined, location)
    } else if (path) {
      // 如果path存在,先处理RecordPath再fillParams
      // 最后返回match的结果
      // 1. resolve relative redirect
      const rawPath = resolveRecordPath(path, record)
      // 2. resolve params
      const resolvedPath = fillParams(rawPath, params, `redirect route with path "${rawPath}"`)
      // 3. rematch with existing query and hash
      return match({
        _normalized: true,
        path: resolvedPath,
        query,
        hash
      }, undefined, location)
    } else {
      if (process.env.NODE_ENV !== 'production') {
        warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
      }
      // 运行到这里证明redirect不对,给个警告,同时返回
      return _createRoute(null, location)
    }
  }

  // 别名
  function alias (
    record: RouteRecord,
    location: Location,
    matchAs: string
  ): Route {
    // 填充参数
    // 运行match
    // 如果match了
    const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${matchAs}"`)
    const aliasedMatch = match({
      _normalized: true,
      path: aliasedPath
    })
    if (aliasedMatch) {
      const matched = aliasedMatch.matched
      const aliasedRecord = matched[matched.length - 1]
      location.params = aliasedMatch.params
      return _createRoute(aliasedRecord, location)
    }
    return _createRoute(null, location)
  }

  // 创建Route

  function _createRoute (
    record: ?RouteRecord,
    location: Location,
    redirectedFrom?: Location
  ): Route {
    // 存在record.redirect
    // 执行redirect
    if (record && record.redirect) {
      return redirect(record, redirectedFrom || location)
    }
    // 存在matchAs就执行alias
    if (record && record.matchAs) {
      return alias(record, location, record.matchAs)
    }
    // 前面都不存在就执行createRoute
    return createRoute(record, location, redirectedFrom, router)
  }

  // 这里返回一个对象,产生一个闭包
  // 这个闭包可以操作
  // pathList, pathMap, nameMap
  return {
    match,
    addRoutes
  }
}

// 匹配Route
function matchRoute (
  regex: RouteRegExp,
  path: string,
  params: Object
): boolean {
  // 判断传入的path是否能够匹配传入的regex正则
  const m = path.match(regex)
  // 如果不匹配就返回false
  if (!m) {
    return false
  } else if (!params) {
    // 如果连参数都没有,直接返回true
    return true
  }
  // 遍历regex.keys
  // 最后把参数中的属性替换成匹配到的值
  for (let i = 1, len = m.length; i < len; ++i) {
    const key = regex.keys[i - 1]
    const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i]
    if (key) {
      params[key.name] = val
    }
  }
  // 返回true
  return true
}
//
function resolveRecordPath (path: string, record: RouteRecord): string {
  return resolvePath(path, record.parent ? record.parent.path : '/', true)
}
