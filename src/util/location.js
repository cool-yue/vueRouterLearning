/* @flow */

import type VueRouter from '../index'
import { parsePath, resolvePath } from './path'
import { resolveQuery } from './query'
import { fillParams } from './params'
import { warn } from './warn'

// 标准化Location
// 第一个参数为rawLocation
// 第二个参数为Route
// 后面的参数为选填
export function normalizeLocation (
  raw: RawLocation,
  current: ?Route,
  append: ?boolean,
  router: ?VueRouter
): Location {
  // 如果raw是字符串路径,那么就包装成一个对象
  // 这个对象为{path:raw}
  let next: Location = typeof raw === 'string' ? { path: raw } : raw
  // named target
  // 如果next具有name属性和_normalized属性
  // 就直接返回next
  if (next.name || next._normalized) {
    return next
  }
  // relative params
  // 如果next没有path属性,但是有params和current属性
  // 这种情况往往不是初始情况
  // 先跳过此处的逻辑
  if (!next.path && next.params && current) {
    next = assign({}, next)
    next._normalized = true
    const params: any = assign(assign({}, current.params), next.params)
    if (current.name) {
      next.name = current.name
      next.params = params
    } else if (current.matched.length) {
      const rawPath = current.matched[current.matched.length - 1].path
      next.path = fillParams(rawPath, params, `path ${current.path}`)
    } else if (process.env.NODE_ENV !== 'production') {
      warn(false, `relative params navigation requires a current route.`)
    }
    return next
  }

  // 解析path路径
  // parsedPath做的工作就是抽取出path中的hash,query和抽取前2部分的url
  const parsedPath = parsePath(next.path || '')
  // 初始化的时候current为根路径也就是 /
  const basePath = (current && current.path) || '/'
  const path = parsedPath.path
    ? resolvePath(parsedPath.path, basePath, append || next.append)
    : basePath

  // 处理query
  const query = resolveQuery(
    parsedPath.query,
    next.query,
    router && router.options.parseQuery
  )
 // 处理hash
  let hash = next.hash || parsedPath.hash
  if (hash && hash.charAt(0) !== '#') {
    hash = `#${hash}`
  }

  // 最后加一个_normalize:true标志着已经标准化
  return {
    _normalized: true,
    path,
    query,
    hash
  }
}

// 将b里面的内容并入到a中
// 有相同的key,按b里面的为准
function assign (a, b) {
  for (const key in b) {
    a[key] = b[key]
  }
  return a
}
