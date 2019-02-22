/* @flow */

import { _Vue } from '../install'
import { warn, isError } from './warn'


// 处理异步组件
// 接受一个参数,这个参数为一个装有RouteRecord的数组
// 这个函数返回一个新的函数,这里存在闭包
// 新的函数会用到传入的matched参数
// 下面来看看这个函数的逻辑
// 这个函数接受3个参数,to,from,next
// 然后执行flatMapComponents
export function resolveAsyncComponents (matched: Array<RouteRecord>): Function {
  return (to, from, next) => {
    let hasAsync = false
    let pending = 0
    let error = null

    flatMapComponents(matched, (def, _, match, key) => {
      // if it's a function and doesn't have cid attached,
      // assume it's an async component resolve function.
      // we are not using Vue's default async resolving mechanism because
      // we want to halt the navigation until the incoming component has been
      // resolved.

      // 第一个参数为components[key]
      // 第二参数为对应的instance[key]
      // 第三个参数为matched中的一个元素,它是上面componets属性和instance属性所在的对象
      // key就当前key
      if (typeof def === 'function' && def.cid === undefined) {
        // 如果取出的components为一个函数
        // 并且cid为undefined
        // 发现了一个异步组件
        // hasAsync = true,然后pending++
        hasAsync = true
        pending++

        // 定义resolve方法
        // resolve方法接受一个参数
        // 首先判断这个参数是否有__esModule和default属性
        // 如果同时存在就拿到default的值
        //
        const resolve = once(resolvedDef => {
          if (resolvedDef.__esModule && resolvedDef.default) {
            resolvedDef = resolvedDef.default
          }

          // 如果resolvedDef是函数,就直接将resolvedDef给def.resolved
          // 如果不是就Vue.extend()一下,生成构造函数然后再给def.resolved
          // save resolved on async factory in case it's used elsewhere
          def.resolved = typeof resolvedDef === 'function'
            ? resolvedDef
            : _Vue.extend(resolvedDef)

          // 将match.components[key] = resolvedDef;
          match.components[key] = resolvedDef
          // pending --
          pending--
          if (pending <= 0) {
            // 如果异步组件的个数小于等于0了
            // 那么就执行next()
            next()
          }
        })

        // 定义reject方法
        const reject = once(reason => {
          // reject主要是处理错误的情况
          // 并且调用next(),将错误的原因传入next()
          const msg = `Failed to resolve async component ${key}: ${reason}`
          process.env.NODE_ENV !== 'production' && warn(false, msg)
          if (!error) {
            error = isError(reason)
              ? reason
              : new Error(msg)
            next(error)
          }
        })

        let res
        try {
          // 此时def是一个components,并且是个异步组件
          // 严格来讲它是一个function
          // 将resolve和reject传入
          // 将该函数执行
          res = def(resolve, reject)
        } catch (e) {
          reject(e)
        }
        if (res) {
          // 如果存在res
          if (typeof res.then === 'function') {
            // 并且res存在then方法
            // 那么就继续执行then
            res.then(resolve, reject)
          } else {
            // new syntax in Vue 2.3
            // 如果res.then不存在
            // 那么就取到res.component
            // 取到component的then方法
            // 然后进行component.then(resolve,reject)
            const comp = res.component
            if (comp && typeof comp.then === 'function') {
              comp.then(resolve, reject)
            }
          }
        }
      }
    })

    // 若果判断出来没有异步组件
    // 那么就直接执行next()
    if (!hasAsync) next()
  }
}


// flatMapComponents接受2个参数
// 一个matched是一个装有RouteRecord的数组
// fn为传入map的函数
// 这里的逻辑是将matched进行map操作,将里面的每一个元素中的components属性组成的数组
// 通过fn来进行转化成为一个新的数组
// 这个fn接受4个参数,这4个参数分别是components[key],m.instances[key],m,key
// 然后再进行深拷贝
export function flatMapComponents (
  matched: Array<RouteRecord>,
  fn: Function
): Array<?Function> {
  return flatten(matched.map(m => {
    return Object.keys(m.components).map(key => fn(
      m.components[key],
      m.instances[key],
      m, key
    ))
  }))
}

// flatten函数接受一个数组，最后返回这个数组与[]的concat的结果，基本上可以认为是深拷贝
export function flatten (arr: Array<any>): Array<any> {
  return Array.prototype.concat.apply([], arr)
}

// in Webpack 2, require.ensure now also returns a Promise
// so the resolve/reject functions may get called an extra time
// if the user uses an arrow function shorthand that happens to
// return that Promise.

// 保证fn只调用一次
function once (fn) {
  let called = false
  return function (...args) {
    if (called) return
    called = true
    return fn.apply(this, args)
  }
}
