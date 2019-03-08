/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { getLocation } from './html5'

// hashHistory继承了history
// HashHistory接受3个参数,分别是router对象,base可以不传,fallback为一个布尔值
// 调用history base类的构造函数,传入router和base
// base是什么,默认一个app应用是"/"开头,如果整个单页应用被放在/app/
// 那么base就是/app/,这个是tomcat或者其他服务器给的资源地址
// 它并不是路由里面对应渲染的一环,所以在后面处理的时候如果匹配到了
// base就要把base给砍掉,因为它们是服务器配置app的路径,不参与路由的匹配
export class HashHistory extends History {
  constructor (router: Router, base: ?string, fallback: boolean) {
    super(router, base)
    // check history fallback deeplinking
    // 如果fallback传入才会检查后面的
    if (fallback && checkFallback(this.base)) {
      return
    }
    // 确保有/,如果没有就会加上/,然后替换
    ensureSlash()
  }

  // this is delayed until the app mounts
  // to avoid the hashchange listener being fired too early
  // 这里会延迟到app挂载的时候防止hashchange listener触发太早了
  setupListeners () {
    // 这里相当于第一次启动
    window.addEventListener('hashchange', () => {
      // 如果这里没有slash那么就什么都不做
      if (!ensureSlash()) {
        return
      }
      // 当hash改变的时候,调用this.transtitionTo
      // 传入当前的hash,第二个参数传入一个方法
      // 该方法接受一个参数,调用replaceHash(route.fullPath)
      // 也就是把当前的location替换成route.fullPath
      this.transitionTo(getHash(), route => {
        replaceHash(route.fullPath)
      })
    })
  }

  // 这里注意下push和replace的区别,由于push是进行的window.location.hash = xxx的操作
  // 这一系列的替换,都会压入到浏览器的history中
  // 而replace是通过window.location.replace,它不会产生历史记录
  // 这两个方法仅此区别

  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    // 后期的push
    // 也是调用的transitionTo方法,第二个参数依旧是个函数
    // 操作主要是window.location.hash = xxx,有历史记录,如果onComplete传入了就调用
    this.transitionTo(location, route => {
      pushHash(route.fullPath)
      onComplete && onComplete(route)
    }, onAbort)
  }

  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    // 后期的replace
    // 也是调用的transitionTo方法,第二个参数依旧是个函数
    // 操作主要是window.location.replace,没有历史,如果onComplete传入了就调用
    this.transitionTo(location, route => {
      replaceHash(route.fullPath)
      onComplete && onComplete(route)
    }, onAbort)
  }

  // 等同于window.go
  go (n: number) {
    window.history.go(n)
  }

  // 确保url
  // 拿到this.current.fullPath,如果它们不等,看push是否置为true
  // 如果是true就push不是就replace
  ensureURL (push?: boolean) {
    const current = this.current.fullPath
    if (getHash() !== current) {
      push ? pushHash(current) : replaceHash(current)
    }
  }
  // 通过window.location.hash切掉#和以前的字符串,拿到hash
  getCurrentLocation () {
    return getHash()
  }
}

// 前提是base存在的情况下才会执行这个函数
// base存在的话,先拿到location
// 如果存在/#这样的字符,证明location是ok
// 如果不存在/#,就在base和location之间加入"/#",
// 因为这是hash模式,没有/#字符,那么相当于hash模式没有意义
// 知道了base就可以确定base后面的为路由
// base就是整个单页应用的首页

// 这里要说下window.location.push和window.location.replace的区别
// 首先这2个操作都会跳转到传入的路径,push回退可以退到跳转之前的页面
// 而replace相当于替换了,回退只能回退到上上个状态

function checkFallback (base) {
  const location = getLocation(base)
  if (!/^\/#/.test(location)) {
    window.location.replace(
      // 将base + '/#' + location拼接成的路径中的//替换成/
      cleanPath(base + '/#' + location)
    )
    return true
  }
}

function ensureSlash (): boolean {
  // 如果hash是/开头
  // 就返回true
  const path = getHash()
  if (path.charAt(0) === '/') {
    return true
  }

  // 把url换成/xxxx/xxxx/xxxx#/xxx
  // 返回false
  replaceHash('/' + path)
  return false
}

export function getHash (): string {
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!

  // 拿到hash
  // 比如xxxx/xxxx/xxxx#hash
  // 这里拿到hash
  const href = window.location.href
  const index = href.indexOf('#')
  return index === -1 ? '' : href.slice(index + 1)
}

// 替换hash
function pushHash (path) {
  window.location.hash = path
}

// 替换hash,在hash不是以/开头的时候
// 会把hash前面加上/,然后替换
// 这里加"#"后,由于base没变,所以不会发请求
function replaceHash (path) {
  const href = window.location.href
  const i = href.indexOf('#')
  const base = i >= 0 ? href.slice(0, i) : href
  window.location.replace(`${base}#${path}`)
}
