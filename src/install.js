import View from './components/view'
import Link from './components/link'

export let _Vue

export function install (Vue) {
  // 首先判断有没有安装,如果安装了就返回
  if (install.installed) return
  // 一旦跳过前面的条件，那么证明还没有安装
  // 那么这里设置installed为true
  install.installed = true

  // 拿到Vue
  _Vue = Vue

  // 定义一个isDef的函数,只要不是undefined就能为true
  const isDef = v => v !== undefined

  // 注册组件
  // 拿到vm的_parentVnode
  // 如果data中有registerRouteInstance
  // 就调用这个函数
  const registerInstance = (vm, callVal) => {
    let i = vm.$options._parentVnode
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal)
    }
  }

  // Vue的options上混入几个钩子函数
  Vue.mixin({
    beforeCreate () {
      if (isDef(this.$options.router)) {
        // 如果$options.router存在
        // 这里针对根组件,显然是存在的

        // 保存2个属性
        this._routerRoot = this
        this._router = this.$options.router
        // 将传入的router进行init(this)
        this._router.init(this)
        // 把 '_route'定义成相应数据,this._route
        // 会访问到this._router.history.current)
        Vue.util.defineReactive(this, '_route', this._router.history.current)
      } else {
        // 这里就是针对子组件的初始化
        // 子组件去找父组件,这样每个子组件的this.$router就会代理到root组件
        // 同理this.$route
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }
      // 注册实例,传入2个this
      registerInstance(this, this)
    },
    // 并入destroyed()
    destroyed () {
      registerInstance(this)
    }
  })

  // 在Vue.prototype上面定义一个$router属性
  // 这个属性返回根组件的_router属性
  Object.defineProperty(Vue.prototype, '$router', {
    get () { return this._routerRoot._router }
  })
  // 在Vue.prototype上面定义一个$route属性
  // 这个属性返回根组件的_route
  // 这个属性指向 this._router.history.current
  Object.defineProperty(Vue.prototype, '$route', {
    get () { return this._routerRoot._route }
  })

  // 注册2个组件
  // router-view
  // router-link
  Vue.component('router-view', View)
  Vue.component('router-link', Link)

  // 合并策略
  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  // 这几个钩子函数的合并策略相同
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
