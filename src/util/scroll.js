/* @flow */

import type Router from '../index'
import { assert } from './warn'
import { getStateKey, setStateKey } from './push-state'

// 创建一个position store对象
// 该对象的prototype为null
const positionStore = Object.create(null)

// setupScroll的原理就是监听popstate
// 然后保存saveScrollPosition
// 如果然后保存e.state.key并且将该key设置为新的状态key
export function setupScroll () {
  window.addEventListener('popstate', e => {
    saveScrollPosition()
    if (e.state && e.state.key) {
      setStateKey(e.state.key)
    }
  })
}

export function handleScroll (
  router: Router,
  to: Route,
  from: Route,
  isPop: boolean
) {
  if (!router.app) {
    return
  }

  // 如果没有传入scrollBehavior就没有handleScroll这一说
  const behavior = router.options.scrollBehavior
  if (!behavior) {
    return
  }

  if (process.env.NODE_ENV !== 'production') {
    assert(typeof behavior === 'function', `scrollBehavior must be a function`)
  }

  // wait until re-render finishes before scrolling
  // 根组件调用$nextTick,其实就是用的微队列,Promise.then()出来的
  // 首先拿到position
  router.app.$nextTick(() => {
    let position = getScrollPosition()
    const shouldScroll = behavior(to, from, isPop ? position : null)
    if (!shouldScroll) {
      return
    }
    const isObject = typeof shouldScroll === 'object'
    if (isObject && typeof shouldScroll.selector === 'string') {
      const el = document.querySelector(shouldScroll.selector)
      if (el) {
        let offset = shouldScroll.offset && typeof shouldScroll.offset === 'object' ? shouldScroll.offset : {}
        offset = normalizeOffset(offset)
        position = getElementPosition(el, offset)
      } else if (isValidPosition(shouldScroll)) {
        position = normalizePosition(shouldScroll)
      }
    } else if (isObject && isValidPosition(shouldScroll)) {
      position = normalizePosition(shouldScroll)
    }

    if (position) {
      window.scrollTo(position.x, position.y)
    }
  })
}

// 保存scroll的position
// 首先拿到key
// 如果有key就在positionStore中以该值为键
// 存在一个对象
// 分别存window.pageXOffset和window.pageYOffset
export function saveScrollPosition () {
  const key = getStateKey()
  if (key) {
    positionStore[key] = {
      x: window.pageXOffset,
      y: window.pageYOffset
    }
  }
}

// 获取滚动位置
// 首先通过getStateKey拿到key
// 然后在positionStore中找到key对应的值
function getScrollPosition (): ?Object {
  const key = getStateKey()
  if (key) {
    return positionStore[key]
  }
}

// 拿到元素的位置
function getElementPosition (el: Element, offset: Object): Object {
  // 拿到document元素
  const docEl: any = document.documentElement
  // 拿到document元素的矩形
  const docRect = docEl.getBoundingClientRect()
  // 拿到目标元素的矩形
  const elRect = el.getBoundingClientRect()
  // 当边距这些因素浏览器默认样式不存在的时候
  // docRect.left 和 offset.x是互为相反数的,同理top和y也一样
  // 现在的问题是如果考虑到document元素外面还有元素占位置,那么实际上
  // 当前元素的top和left的参考系就变了,假如说顶部有其他东西占位置
  // 实际上docRect.top为0的时候,offset.y为一个大于0的数,因为doc上面有元素
  // 需要滑动一定的距离,因此elRect.left的实际是相对document的位置就要减去这个差值
  // 最后就变成了下面这个形式
  return {
    x: elRect.left - docRect.left - offset.x,
    y: elRect.top - docRect.top - offset.y
  }
}

// 是合法的位置
// 只要obj.x或者obj.y有一个是数字
function isValidPosition (obj: Object): boolean {
  return isNumber(obj.x) || isNumber(obj.y)
}

// 标准化position
function normalizePosition (obj: Object): Object {
  return {
    x: isNumber(obj.x) ? obj.x : window.pageXOffset,
    y: isNumber(obj.y) ? obj.y : window.pageYOffset
  }
}

// 标准化offset,是数字就返回,不是数字就设置为0
function normalizeOffset (obj: Object): Object {
  return {
    x: isNumber(obj.x) ? obj.x : 0,
    y: isNumber(obj.y) ? obj.y : 0
  }
}

// 判断这个值是number
function isNumber (v: any): boolean {
  return typeof v === 'number'
}
