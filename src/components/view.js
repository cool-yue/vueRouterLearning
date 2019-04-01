import { warn } from '../util/warn'

// router-view属于函数式组件
export default {
  name: 'router-view',
  functional: true,
  props: {
    // 接收一个name属性
    // 表示router-view可以是具名组件
    name: {
      type: String,
      default: 'default'
    }
  },
  // render函数
  render (_, { props, children, parent, data }) {
    // 设置一个routerView字段为true
    data.routerView = true

    // directly use parent context's createElement() function
    // so that components rendered by router-view can resolve named slots
    // 直接使用父上下文的context's createElement()函数
    // 这样可以使通过router-view渲染的组件能够去处理具名slots?为什么呢？

    // 由于render的调用环境是这样的
    // render.call(vm,$createElement)

    // 拿到parent.$createElement
    // 拿到props.name,拿到父组件的$route对象
    // 拿到parent._routerViewCache如果没有的话就创建一个空的对象
    const h = parent.$createElement
    const name = props.name
    const route = parent.$route
    const cache = parent._routerViewCache || (parent._routerViewCache = {})

    // determine current view depth, also check to see if the tree
    // has been toggled inactive but kept-alive.

    let depth = 0
    let inactive = false
    // 这里循环找parent,直到parent._routerRoot === parent
    // 也就是说找到根组件
    while (parent && parent._routerRoot !== parent) {
      if (parent.$vnode && parent.$vnode.data.routerView) {
        // 每循环一次如果$vnode.data.routerView存在
        // 那么depth就自增1
        depth++
      }
      // 如果parent._inactive为true
      // 那么inactive设置为true
      // parent只要有一个是inactive,表示已经失去活性
      if (parent._inactive) {
        inactive = true
      }
      // 将parent设置为parent的$parent进行下一次循环
      parent = parent.$parent

      //循环上面的过程,直到parent.$vnode.data._routerRoot === parent
    }
    // 循环完成后,将depth的值给data.routerViewDepth
    data.routerViewDepth = depth

    // render previous view if the tree is inactive and kept-alive
    // 如果当前的router的parent是失活的
    // 直接就return
    if (inactive) {
      return h(cache[name], data, children)
    }

    // 拿到$route对象的matched[depth]
    const matched = route.matched[depth]

    // render empty node if no matched route
    // 如果没有匹配到,返回一个空节点
    if (!matched) {
      cache[name] = null
      return h()
    }

    // 在matched的components属性中根据name取到对应的组件
    const component = cache[name] = matched.components[name]

    // attach instance registration hook
    // this will be called in the instance's injected lifecycle hooks

    // 在data中定义一个函数
    // 这个函数接受2个参数
    // 首先通过name去取matched.instances[name]
    // 如果传入的val值存在并且current !== vm
    // 或者val没有值,但是current === vm
    // 那么就在matched.instances[name] = val

    data.registerRouteInstance = (vm, val) => {
      // val could be undefined for unregistration
      const current = matched.instances[name]
      if (
        (val && current !== vm) ||
        (!val && current === vm)
      ) {
        matched.instances[name] = val
      }
    }

    // also regiseter instance in prepatch hook
    // in case the same component instance is reused across different routes
    // 如果data.hook存在
    // 那么就在将data.hook.prepatch设置为一个函数
    // 这个函数要做的事情就是
    // matched.instances[name] = vnode.componentInstance
    ;(data.hook || (data.hook = {})).prepatch = (_, vnode) => {
      matched.instances[name] = vnode.componentInstance
    }

    // resolve props
    // 按照一定的规则处理props
    data.props = resolveProps(route, matched.props && matched.props[name])

    // 最后返回h(component,data,children)
    return h(component, data, children)
  }
}

// 处理Props属性
// 如果matched.props[name]是对象就直接返回
// 是函数,返回该函数的调用,并把route传入config
function resolveProps (route, config) {
  switch (typeof config) {
    case 'undefined':
      return
    case 'object':
      return config
    case 'function':
      return config(route)
    case 'boolean':
      return config ? route.params : undefined
    default:
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false,
          `props in "${route.path}" is a ${typeof config}, ` +
          `expecting an object, function or boolean.`
        )
      }
  }
}