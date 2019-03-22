/* @flow */

import Regexp from 'path-to-regexp'
import { cleanPath } from './util/path'
import { assert, warn } from './util/warn'

/*
const routes = [
  { path: '/foo', component: Foo },
  { path: '/bar', component: Bar }
]
*/

export function createRouteMap (
  routes: Array<RouteConfig>,
  oldPathList?: Array<string>,
  oldPathMap?: Dictionary<RouteRecord>,
  oldNameMap?: Dictionary<RouteRecord>
): {
  pathList: Array<string>;
  pathMap: Dictionary<RouteRecord>;
  nameMap: Dictionary<RouteRecord>;
} {

  // the path list is used to control path matching priority
  const pathList: Array<string> = oldPathList || []
  const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null)
  const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null)

  // 遍历routes
  // 调用addRouteRecord
  // 下面的方法将path标准化后,将其他存在的参数一起拼装成一个record
  // 然后将path push到 pathList
  // 将path作为key,值为record存入pathMap
  routes.forEach(route => {
    addRouteRecord(pathList, pathMap, nameMap, route)
  })

  // ensure wildcard routes are always at the end
  // 确保通配符的routes总在最后
  // 这个代码真的是风骚
  for (let i = 0, l = pathList.length; i < l; i++) {
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0])
      l--
      i--
    }
  }

  return {
    pathList,
    pathMap,
    nameMap
  }
}

// 初始化的时候这里传入了第四个参数
/*
const routes = [
  { path: '/foo', component: Foo },
  { path: '/bar', component: Bar }
]
*/
function addRouteRecord (
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>,
  route: RouteConfig,
  parent?: RouteRecord,
  matchAs?: string
) {
  // 拿到一条记录的path和name,这里没有name
  const { path, name } = route
  if (process.env.NODE_ENV !== 'production') {
    assert(path != null, `"path" is required in a route configuration.`)
    assert(
      typeof route.component !== 'string',
      `route config "component" for path: ${String(path || name)} cannot be a ` +
      `string id. Use an actual component instead.`
    )
  }
  // 标准化path
  // 按照最简单的例子parent这里为undefined
  // path的标准化基本上就是拼接parent(如果存在)的path,替换掉最后的斜杠
  const normalizedPath = normalizePath(path, parent)
  // 这里没传
  const pathToRegexpOptions: PathToRegexpOptions = route.pathToRegexpOptions || {}

  // 如果传入了caseSensitive
  // 这里假定没传
  if (typeof route.caseSensitive === 'boolean') {
    pathToRegexpOptions.sensitive = route.caseSensitive
  }

  // 创建一个record
  // 其中path有值,其余的都没值
  const record: RouteRecord = {
    path: normalizedPath,
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),
    components: route.components || { default: route.component },
    instances: {},
    name,
    parent,
    matchAs,
    redirect: route.redirect,
    beforeEnter: route.beforeEnter,
    meta: route.meta || {},
    props: route.props == null
      ? {}
      : route.components
        ? route.props
        : { default: route.props }
  }

  // route这里也没有值
  if (route.children) {
    // Warn if route is named, does not redirect and has a default child route.
    // If users navigate to this route by name, the default child will
    // not be rendered (GH Issue #629)
    if (process.env.NODE_ENV !== 'production') {
      if (route.name && !route.redirect && route.children.some(child => /^\/?$/.test(child.path))) {
        warn(
          false,
          `Named Route '${route.name}' has a default child route. ` +
          `When navigating to this named route (:to="{name: '${route.name}'"), ` +
          `the default child route will not be rendered. Remove the name from ` +
          `this route and use the name of the default child route for named ` +
          `links instead.`
        )
      }
    }
    // 如果检测到有children属性把children的属性也生成record
    // 处理children的时候由于parentRecord已经生成,因此parent已经存在
    // 同时看parentRecord有没有matchAs也就是别名,有的话把matchAs作为父路径
    // 同理那么子record的matchAs就是父亲的matchAs/child.path
    route.children.forEach(child => {
      const childMatchAs = matchAs
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
    })
  }

  // 这里也没值
  // 如果存在alias,有alias也就是别名，无非就是用别名作为path再来添加一次record
  // 这里要注意的是最后一个参数用的是当前record.path,
  // aliasRoute中只存在{path:alias 和 children}
  // 所以alias生成的record并没有components,因为没传入component或者components
  // 但是alias生成的record存在matchAs这个字段，这个字段就是Record.path这个字段
  // 至于children,由于父路由组件由别名,因此在这个父组件下面的子组件也需要可以匹配这个别名
  // 最终继续将它们全部放入pathList,pathMap,nameMap集合中
  if (route.alias !== undefined) {
    const aliases = Array.isArray(route.alias)
      ? route.alias
      : [route.alias]

    aliases.forEach(alias => {
      const aliasRoute = {
        path: alias,
        children: route.children
      }
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute,
        parent,
        record.path || '/' // matchAs
      )
    })
  }

  // patchMap是一个空对象
  // pathList这时是空数组
  // 这里条件满足
  if (!pathMap[record.path]) {
    // pathList存入这个path
    // path为键,record为键
    pathList.push(record.path)
    pathMap[record.path] = record
  }
  // 这里name也没有
  if (name) {
    if (!nameMap[name]) {
      nameMap[name] = record
    } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
      warn(
        false,
        `Duplicate named routes definition: ` +
        `{ name: "${name}", path: "${record.path}" }`
      )
    }
  }
}

// 解析Route的正则
//
function compileRouteRegex (path: string, pathToRegexpOptions: PathToRegexpOptions): RouteRegExp {
  const regex = Regexp(path, [], pathToRegexpOptions)
  if (process.env.NODE_ENV !== 'production') {
    const keys: any = {}
    regex.keys.forEach(key => {
      warn(!keys[key.name], `Duplicate param keys in route with path: "${path}"`)
      keys[key.name] = true
    })
  }
  return regex
}


// 标准化的过程
function normalizePath (path: string, parent?: RouteRecord): string {
  // 如果path以"/"结尾的这个斜杠将其去掉
  path = path.replace(/\/$/, '')
  // 替换完了之后
  // 如果第一个字符为'/'这个表示从根目录开始,所以不需要parent
  // 如果parent为null也返回
  // 如果parent不为null,就拼接一个parent.path
  if (path[0] === '/') return path
  if (parent == null) return path
  return cleanPath(`${parent.path}/${path}`)
}
