/* @flow */

import { _Vue } from '../install'
import type Router from '../index'
import { inBrowser } from '../util/dom'
import { runQueue } from '../util/async'
import { warn, isError } from '../util/warn'
import { START, isSameRoute } from '../util/route'
import {
  flatten,
  flatMapComponents,
  resolveAsyncComponents
} from '../util/resolve-components'

// history类
export class History {
  router: Router;
  base: string;
  current: Route;
  pending: ?Route;
  cb: (r: Route) => void;
  ready: boolean;
  readyCbs: Array<Function>;
  readyErrorCbs: Array<Function>;
  errorCbs: Array<Function>;

  // implemented by sub-classes
  +go: (n: number) => void;
  +push: (loc: RawLocation) => void;
  +replace: (loc: RawLocation) => void;
  +ensureURL: (push?: boolean) => void;
  +getCurrentLocation: () => string;

  constructor (router: Router, base: ?string) {
    // 接受2个参数
    // 将vue-router实例传进来
    this.router = router
    this.base = normalizeBase(base)
    // start with a route object that stands for "nowhere"
    // start的为一个path为"/"的route对象
    this.current = START
    // 其余的属性仅仅做一个初始化
    this.pending = null
    this.ready = false
    this.readyCbs = []
    this.readyErrorCbs = []
    this.errorCbs = []
  }

  listen (cb: Function) {
    this.cb = cb
  }

  onReady (cb: Function, errorCb: ?Function) {
    if (this.ready) {
      cb()
    } else {
      this.readyCbs.push(cb)
      if (errorCb) {
        this.readyErrorCbs.push(errorCb)
      }
    }
  }

  onError (errorCb: Function) {
    this.errorCbs.push(errorCb)
  }

// 关键方法
// 第一个参数为需要进入的路由
  transitionTo (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    // 首先通过this.router.match()方法把location和this.current作为参数传进去获得route
    const route = this.router.match(location, this.current)
    // 然后执行confirmTransition,其中传入了2个函数,一个是onComplete一个是onAbort
    // 可以看到tansitionTo实际调用的就是confirmTransition
    // 同时接受3个参数,这3个参数,将location,onComplete,onAbort进行了再一次封装和改造

    // location => route
    // onComplete 继续包装,在onComplete的前后分别插入this.updateRoute和this.ensureURL()
    this.confirmTransition(route, () => {
      this.updateRoute(route)
      onComplete && onComplete(route)
      this.ensureURL()

      // fire ready cbs once
      if (!this.ready) {
        this.ready = true
        this.readyCbs.forEach(cb => { cb(route) })
      }
    }, err => {
      if (onAbort) {
        onAbort(err)
      }
      if (err && !this.ready) {
        this.ready = true
        this.readyErrorCbs.forEach(cb => { cb(err) })
      }
    })
  }

  confirmTransition (route: Route, onComplete: Function, onAbort?: Function) {
    const current = this.current
    const abort = err => {
      if (isError(err)) {
        if (this.errorCbs.length) {
          this.errorCbs.forEach(cb => { cb(err) })
        } else {
          warn(false, 'uncaught error during route navigation:')
          console.error(err)
        }
      }
      onAbort && onAbort(err)
    }
    if (
      isSameRoute(route, current) &&
      // in the case the route map has been dynamically appended to
      route.matched.length === current.matched.length
    ) {
      this.ensureURL()
      return abort()
    }

    const {
      updated,
      deactivated,
      activated
    } = resolveQueue(this.current.matched, route.matched)

    const queue: Array<?NavigationGuard> = [].concat(
      // in-component leave guards
      extractLeaveGuards(deactivated),
      // global before hooks
      this.router.beforeHooks,
      // in-component update hooks
      extractUpdateHooks(updated),
      // in-config enter guards
      activated.map(m => m.beforeEnter),
      // async components
      resolveAsyncComponents(activated)
    )

    // 函数运行到这里说明了需要转移的route和当前route是不一样的
    // 在转移之前先做一些准备
    // 因为route和current不同,所以pending就是route
    this.pending = route
    const iterator = (hook: NavigationGuard, next) => {
      if (this.pending !== route) {
        return abort()
      }
      try {
        hook(route, current, (to: any) => {
          if (to === false || isError(to)) {
            // next(false) -> abort navigation, ensure current URL
            this.ensureURL(true)
            abort(to)
          } else if (
            typeof to === 'string' ||
            (typeof to === 'object' && (
              typeof to.path === 'string' ||
              typeof to.name === 'string'
            ))
          ) {
            // next('/') or next({ path: '/' }) -> redirect
            abort()
            if (typeof to === 'object' && to.replace) {
              this.replace(to)
            } else {
              this.push(to)
            }
          } else {
            // confirm transition and pass on the value
            next(to)
          }
        })
      } catch (e) {
        abort(e)
      }
    }

    runQueue(queue, iterator, () => {
      const postEnterCbs = []
      const isValid = () => this.current === route
      // wait until async components are resolved before
      // extracting in-component enter guards
      const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid)
      const queue = enterGuards.concat(this.router.resolveHooks)
      runQueue(queue, iterator, () => {
        if (this.pending !== route) {
          return abort()
        }
        this.pending = null
        onComplete(route)
        if (this.router.app) {
          this.router.app.$nextTick(() => {
            postEnterCbs.forEach(cb => { cb() })
          })
        }
      })
    })
  }

  updateRoute (route: Route) {
    const prev = this.current
    this.current = route
    this.cb && this.cb(route)
    this.router.afterHooks.forEach(hook => {
      hook && hook(route, prev)
    })
  }
}

// 标准化
function normalizeBase (base: ?string): string {
  if (!base) {
    if (inBrowser) {
      // respect <base> tag
      // 如果是浏览器环境,拿到页面的base标签的href值
      const baseEl = document.querySelector('base')
      base = (baseEl && baseEl.getAttribute('href')) || '/'
      // strip full URL origin
      // 将base的http://或者https://替换掉
      base = base.replace(/^https?:\/\/[^\/]+/, '')
    } else {
      // 如果不是浏览器环境
      base = '/'
    }
  }
  // make sure there's the starting slash
  // 如果base的第一个字符部位'/'那么加上这个'/'
  if (base.charAt(0) !== '/') {
    base = '/' + base
  }
  // remove trailing slash
  // 如果最尾部有'/',那么替换掉
  return base.replace(/\/$/, '')
}

// 处理队列
function resolveQueue (
  current: Array<RouteRecord>,
  next: Array<RouteRecord>
): {
  updated: Array<RouteRecord>,
  activated: Array<RouteRecord>,
  deactivated: Array<RouteRecord>
} {
  let i
  // 取到current.length和next.length 2个中 较大的那个
  const max = Math.max(current.length, next.length)
  // 用这个较大的值,进行循环遍历current和next中的值
  // 只要发现不相等的时候就退出循环
  // 此时i记录了第一次current和next中出现不相等时候的索引
  // 可以认为从i开始(包含i),current中的东西与next不再相等
  // 因此在current[i]以后的为deactivated
  // 在next[i]中以及以后的元素为activated
  // 在next[0,i)中同时也在current中存在
  // 认为这里是更新的即updated
  for (i = 0; i < max; i++) {
    if (current[i] !== next[i]) {
      break
    }
  }
  return {
    updated: next.slice(0, i),
    activated: next.slice(i),
    deactivated: current.slice(i)
  }
}

// 抽取guard,路由守卫
// 第一个参数为目标对象
// 第二个为对象名字
// 第三个bind为一个方法
// 第四个参数为可选,是一个布尔值,表示是否反转
// 例如第二个name参数可以是beforeRouteLeave,
// 那么就从一个装有RouteRecord的一个数组中去过滤出名字为name的guard
// 例如beforeRouteLeave,如果guard是一个数组那么就map然后对每个
// guard进行bind上下文,也就是对应的实例
// 如果guard不是数组就是直接bind上下文
function extractGuards (
  records: Array<RouteRecord>,
  name: string,
  bind: Function,
  reverse?: boolean
): Array<?Function> {
  const guards = flatMapComponents(records, (def, instance, match, key) => {
    const guard = extractGuard(def, name)
    if (guard) {
      return Array.isArray(guard)
        ? guard.map(guard => bind(guard, instance, match, key))
        : bind(guard, instance, match, key)
    }
  })
  return flatten(reverse ? guards.reverse() : guards)
}

// 抽取出guard
// 接受2个参数,一个是def,一个key
// 如果def不是函数,就用Vue.extend将其转变为构造函数
// 最后return def.options[key]
// 也就是拿到def的options属性中的对应的key(变量)属性
function extractGuard (
  def: Object | Function,
  key: string
): NavigationGuard | Array<NavigationGuard> {
  if (typeof def !== 'function') {
    // extend now so that global mixins are applied.
    def = _Vue.extend(def)
  }
  return def.options[key]
}

// 抽取出beforeRouteLeave,注意,它存在反转
function extractLeaveGuards (deactivated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}

// 抽取出beforeRouteUpdate
function extractUpdateHooks (updated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

// bindGuard顾名思义就是绑定guard的上下文环境
// 上下文环境就是instance
function bindGuard (guard: NavigationGuard, instance: ?_Vue): ?NavigationGuard {
  if (instance) {
    return function boundRouteGuard () {
      return guard.apply(instance, arguments)
    }
  }
}

// 抽取出beforeRouteEnter
// 这里跟其余2个组件guard不同,beforeRouteEnter
// 这里没有instance这个bind,因此这里只能通过cb
// 也就是回调来进行this的访问
// 因为回调会放入poll里面
function extractEnterGuards (
  activated: Array<RouteRecord>,
  cbs: Array<Function>,
  isValid: () => boolean
): Array<?Function> {
  return extractGuards(activated, 'beforeRouteEnter', (guard, _, match, key) => {
    return bindEnterGuard(guard, match, key, cbs, isValid)
  })
}

// bindEnterGuard接受4个参数
// 这个函数返回一个函数function(to,from.next) {}
// 内层的函数的逻辑是执行guard函数
// 将to,from作为前2个参数,第三个参数为一个函数
// 其中函数的参数为一个回调,会执行next(cb)
// 如果cb是函数,就把cb压入一个cbs的函数数组
// 同时包装一个poll,理由是:
// 使用poll的原因是,当router-view被一个out-in的transition包装的时候
// instance可能还没有注册,需要轮询到它注册直到当前route已经不存在了
function bindEnterGuard (
  guard: NavigationGuard,
  match: RouteRecord,
  key: string,
  cbs: Array<Function>,
  isValid: () => boolean
): NavigationGuard {
  return function routeEnterGuard (to, from, next) {
    return guard(to, from, cb => {
      next(cb)
      if (typeof cb === 'function') {
        cbs.push(() => {
          // #750
          // if a router-view is wrapped with an out-in transition,
          // the instance may not have been registered at this time.
          // we will need to poll for registration until current route
          // is no longer valid.
          poll(cb, match.instances, key, isValid)
        })
      }
    })
  }
}

// poll轮询?
// 接受4个参数
// 首先如果存在instance,那个就直接调用cb(instance)
// 如果不存在instance但是isValid函数返回了true
// 那么就设置16毫秒的延时来递归执行poll
// 使用poll的原因是,当router-view被一个out-in的transition包装的时候
// instance可能还没有注册,需要轮询到它注册知道当前route已经不存在了
function poll (
  cb: any, // somehow flow cannot infer this is a function
  instances: Object,
  key: string,
  isValid: () => boolean
) {
  if (instances[key]) {
    cb(instances[key])
  } else if (isValid()) {
    setTimeout(() => {
      poll(cb, instances, key, isValid)
    }, 16)
  }
}
