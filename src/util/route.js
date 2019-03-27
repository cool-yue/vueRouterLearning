/* @flow */

import type VueRouter from '../index'
import { stringifyQuery } from './query'

const trailingSlashRE = /\/?$/

// 创建一个route对象
// 具体看route的type script
// 基本就是把location里面的一些属性拿出来重新组织成一个route对象
// 最后将这个对象进行冻结
export function createRoute (
  record: ?RouteRecord,
  location: Location,
  redirectedFrom?: ?Location,
  router?: VueRouter
): Route {
  const stringifyQuery = router && router.options.stringifyQuery
  const route: Route = {
    name: location.name || (record && record.name),
    meta: (record && record.meta) || {},
    path: location.path || '/',
    hash: location.hash || '',
    query: location.query || {},
    params: location.params || {},
    fullPath: getFullPath(location, stringifyQuery),
    matched: record ? formatMatch(record) : []
  }
  if (redirectedFrom) {
    route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery)
  }
  return Object.freeze(route)
}

// the starting route that represents the initial state
export const START = createRoute(null, {
  path: '/'
})

// 这里如果传入了record
// 如果有record那么插入到一个数组的开头
// 如果这个record有parent,继续把parent插入到第一个直到没有parent位置
// 打比方,比如路径为/aaa/bbb/ccc对应3个组件record,AAA,BBB,CCC
// 那么path为/aaa/bbb/ccc的matcher为[AAA,BBB,CCC]
function formatMatch (record: ?RouteRecord): Array<RouteRecord> {
  const res = []
  while (record) {
    res.unshift(record)
    record = record.parent
  }
  return res
}

//那么完整路径,有path有query有hash
function getFullPath (
  { path, query = {}, hash = '' },
  _stringifyQuery
): string {
  const stringify = _stringifyQuery || stringifyQuery
  return (path || '/') + stringify(query) + hash
}

// 判断a和b是否是同一个route
// 通常第一个传入的是用户push的
// 第二个是current的
export function isSameRoute (a: Route, b: ?Route): boolean {
  // 如果current是start,也就是根路径
  if (b === START) {
    // 那么直接返回a===b,也就是比较2个对象是否完全一样
    return a === b
  } else if (!b) {
    // 如果没有current
    // 返回false
    return false
  } else if (a.path && b.path) {
    // 如果a.path和b.path都有,但是b又不是根路径
    // 这个时候,先去掉path结尾的'/'
    // 然后看这2个字符串是否相等
    // a.hash是否等于b.hash
    // 最后判断a.query的值是否等于b.query
    return (
      a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') &&
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query)
    )
  } else if (a.name && b.name) {
    // 走到这里表示没有path,但是有a,b同时有name
    return (
      // 这里就要满足一下4个条件
      a.name === b.name &&
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query) &&
      isObjectEqual(a.params, b.params)
    )
  } else {
    // 走到这里返回false
    return false
  }
}

// 判断2个对象是否相等
// 拿到a和b的键值数组
// 如果长度不一样直接返回false
// 然后遍历其中一个数组
// 要求每一个都满足值相等
// 如果内部有对象,递归
function isObjectEqual (a = {}, b = {}): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every(key => {
    const aVal = a[key]
    const bVal = b[key]
    // check nested equality
    if (typeof aVal === 'object' && typeof bVal === 'object') {
      return isObjectEqual(aVal, bVal)
    }
    return String(aVal) === String(bVal)
  })
}

export function isIncludedRoute (current: Route, target: Route): boolean {
  return (
    current.path.replace(trailingSlashRE, '/').indexOf(
      target.path.replace(trailingSlashRE, '/')
    ) === 0 &&
    (!target.hash || current.hash === target.hash) &&
    queryIncludes(current.query, target.query)
  )
}

function queryIncludes (current: Dictionary<string>, target: Dictionary<string>): boolean {
  for (const key in target) {
    if (!(key in current)) {
      return false
    }
  }
  return true
}
