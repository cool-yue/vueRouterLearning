/* @flow */
// 一些断言的方法,警告,错误的方法

export function assert (condition: any, message: string) {
  if (!condition) {
    throw new Error(`[vue-router] ${message}`)
  }
}

// 执行console.warn
export function warn (condition: any, message: string) {
  if (process.env.NODE_ENV !== 'production' && !condition) {
    typeof console !== 'undefined' && console.warn(`[vue-router] ${message}`)
  }
}

// 判断传入的参数是否是Error对象
export function isError (err: any): boolean {
  return Object.prototype.toString.call(err).indexOf('Error') > -1
}
