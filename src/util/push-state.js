/* @flow */

import { inBrowser } from './dom'
import { saveScrollPosition } from './scroll'

export const supportsPushState = inBrowser && (function () {
  const ua = window.navigator.userAgent

  if (
    (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
    ua.indexOf('Mobile Safari') !== -1 &&
    ua.indexOf('Chrome') === -1 &&
    ua.indexOf('Windows Phone') === -1
  ) {
    return false
  }

  return window.history && 'pushState' in window.history
})()

// use User Timing api (if present) for more accurate key precision
// Time对象最终可能是window.performance或者是Date
// 这2个api都有now()这个属性,Date是一种优雅降级的方式
// Date.now返回的是时间搓
// 而performance.now()返回的是页面加载开始到执行这个函数之间的时间
const Time = inBrowser && window.performance && window.performance.now
  ? window.performance
  : Date

// 设置一个_key,它的值为genKey()
let _key: string = genKey()

// 生成key
function genKey (): string {
  return Time.now().toFixed(3)
}

// 返回拿到key
export function getStateKey () {
  return _key
}

// setKey
export function setStateKey (key: string) {
  _key = key
}

export function pushState (url?: string, replace?: boolean) {
  // 保存当前scrollPostion的位置
  saveScrollPosition()
  // try...catch the pushState call to get around Safari
  // DOM Exception 18 where it limits to 100 pushState calls
  const history = window.history
  try {
    // 如果是replace的话,就history.replaceState
    // 第一个参数传入对应的key值,方便在popstate事件中的event.state.key中拿到这个值
    // 从而可以通过这个key去拿到postition
    if (replace) {
      history.replaceState({ key: _key }, '', url)
    } else {
      // 如果不是repalce那么就生成一个新的key
      // 然后push进去
      _key = genKey()
      history.pushState({ key: _key }, '', url)
    }
  } catch (e) {
    window.location[replace ? 'replace' : 'assign'](url)
  }
}

// replaceState实际执行的也是pushState
// 同时第二个参数传入的是true
export function replaceState (url?: string) {
  pushState(url, true)
}
