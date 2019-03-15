/* @flow */

export function runQueue (queue: Array<?NavigationGuard>, fn: Function, cb: Function) {
  // 这个queue里面装有guard方法
  // 定义一个step方法
  // 这个step方法传入index作为参数
  // 如果index>queue.length
  // 那么就执行cb()
  // 如果queue[index]存在就把这个作为fn的第一个参数
  // 回调里面运行step(index+1)
  // 如果queue[index]不存在,那么就直接运行step(index+1)
  const step = index => {
    if (index >= queue.length) {
      cb()
    } else {
      if (queue[index]) {
        fn(queue[index], () => {
          step(index + 1)
        })
      } else {
        step(index + 1)
      }
    }
  }
  step(0)
}
