/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState } from '../util/push-state'

// history模式
// 相对于hash模式,history多了一个expectScroll
// 也就是说页面在滚动了多少也有记录,历史模式监听的事件不一样\
// 因为历史模式没有#这个符号了,所以不再需要检测hash的变化
// 因此监听的是popstate这个事件,因为hash模式只是修改了#后面的内容
// 刷新浏览器是不会发送请求的,而history没有这个#号,虽然美观了，但是刷新
// 之后会发送请求,而且路径是一个资源的请求,显然会出现404
// 同时要注意的是pushState和raplaceState会把url的值给换掉,但是依旧不会发请求
// 监听popstate是为了方便的后退和前进,这个动作依旧不发送请求,只是监听到了之后
// 路由再去更新视图和位置

export class HTML5History extends History {
  constructor (router: Router, base: ?string) {
    super(router, base)
    // 拿到配置options.scrollBehavior
    // 如果存在就setupScroll()
    // scrollBehavior是一个函数,如果传了这个函数
    // 就会去setupScroll
    const expectScroll = router.options.scrollBehavior

    if (expectScroll) {
      setupScroll()
    }

    window.addEventListener('popstate', e => {
      const current = this.current
      this.transitionTo(getLocation(this.base), route => {
        if (expectScroll) {
          // 每一次的popstate事件发生的时候
          // 如果传入了scrollBehavior函数,都会进行handleScroll
          handleScroll(router, route, current, true)
        }
      })
    })
  }

  // 等同于history.go
  go (n: number) {
    window.history.go(n)
  }

  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => {
      pushState(cleanPath(this.base + route.fullPath))
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }

  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => {
      replaceState(cleanPath(this.base + route.fullPath))
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }

  ensureURL (push?: boolean) {
    if (getLocation(this.base) !== this.current.fullPath) {
      const current = cleanPath(this.base + this.current.fullPath)
      push ? pushState(current) : replaceState(current)
    }
  }

  getCurrentLocation (): string {
    return getLocation(this.base)
  }
}


// getLocation
// path为根路径开始的路径
// 比如localhost:8080/aaa/bbb/ccc
// pathname为/aaa/bbb/ccc
// 如果base存在,并且在pathname中的index为0
// 也就是开头就匹配,那么就把这个base给切掉
// 如果不是开头匹配,就不管
// window.location.search 取到的是 ?开头的字符串
// 最后的返回 path + search + hash
export function getLocation (base: string): string {
  let path = window.location.pathname
  if (base && path.indexOf(base) === 0) {
    path = path.slice(base.length)
  }
  return (path || '/') + window.location.search + window.location.hash
}
