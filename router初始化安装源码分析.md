router是一个单页应用怎么也绕不开的一个话题，在分析源码之前，如果自己要实现一个router，可能也就是通过hashChange这个事件，window.location.hash,然后结合dom来将页面通过事件的形式进行替换，那么来看看vueRouter是如何做的。

## install ##
在安装vueRouter之前要做的事情就是:

    npm install vue-router
    import Vue from 'vue'
    import VueRouter from 'vue-router'
    Vue.use(VueRouter)

通常前端工程化之后,基本上就是按照上面的几部来完成vueRouter的安装，都知道Vue.use方法实际上是调用VueRouter的install方法，如果VueRouter为funtion,那么就直接调用这个function,下面来看看VueRouter是个什么东西。由于使用的是es6的import语法，因此会找到index.js这样一个文件，下面来看看index.js文件如何暴露的。

    export default class VueRouter {
      static install: () => void;
      static version: string;
    }
    
    VueRouter.install = install
    VueRouter.version = '__VERSION__'

纵观整个vueRouter发现只有一个export,这个export导出的一个VueRouter的构造函数,同时这个构造函数上面有2个静态属性,一个是install一个version,所这里就能够明确`Vue.use(vueRouter)`实际上调用的就是intall方法,下面来看看instal方法做了什么。首先install导入了2个组件，它们分别是`route-view`和`route-link`。

    import View from './components/view'
    import Link from './components/link'

导出2个东西，一个是`_vue`一个是`install`方法
    
    export let _Vue
    export function install (Vue) {}

`install`的第一个参数Vue显然是Vue的构造函数，下面分析其中的逻辑。

    if (install.installed) return
     install.installed = true
    _Vue = Vue
    const isDef = v => v !== undefined
    
    const registerInstance = (vm, callVal) => {
	    let i = vm.$options._parentVnode
	    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
	      i(vm, callVal)
	    }
    }

首先如果安装了,就返回，避免多次安装，其次将`Vue`赋给`_Vue`,保存`Vue`的一个引用,定义一个`isDef`的函数,注意该函数只判断了传入的值不为`undefined`,也就说只要不是`undefined`这个值,都返回true,然后定义了一个`registerInstance`函数,该函数做的事情是判断`Vnode`的`data`上面是否有`registerRouteInstance`这个方法，如果有的话，就调用,如果没有,什么事情都不做,继续往下看。


      // Vue的options上混入几个钩子函数
     Vue.mixin({
	    beforeCreate () {
	    },
	    destroyed () {
    	}
      })

`Vue.mixin`来混入`beforeCreate`和`destroyed`,通过以前的分析可以知道`Vue.mixin`就是调用`mergeOptions`,而该方法的实现思路就是,针对不同的属性名称,根据不同的策略来进行属性的合并,上面合并了2个钩子,针对钩子的合并策略,也就是共存策略,也就是用户自定义的钩子和`mixin`的钩子会共存。下面来看看beforeCreate钩子函数执行了什么。
`beforeCreate`为什么会执行呢,只有在组件实例化的时候，才会执行。下面根据管方最简单的demo来看看。


    // 0. If using a module system (e.g. via vue-cli), import Vue and VueRouter
    // and then call `Vue.use(VueRouter)`.
    
    // 1. Define route components.
    // These can be imported from other files
    const Foo = { template: '<div>foo</div>' }
    const Bar = { template: '<div>bar</div>' }
    
    // 2. Define some routes
    // Each route should map to a component. The "component" can
    // either be an actual component constructor created via
    // `Vue.extend()`, or just a component options object.
    // We'll talk about nested routes later.
    const routes = [
      { path: '/foo', component: Foo },
      { path: '/bar', component: Bar }
    ]
    
    // 3. Create the router instance and pass the `routes` option
    // You can pass in additional options here, but let's
    // keep it simple for now.
    const router = new VueRouter({
      routes // short for `routes: routes`
    })
    
    // 4. Create and mount the root instance.
    // Make sure to inject the router with the router option to make the
    // whole app router-aware.
    const app = new Vue({
      router
    }).$mount('#app')
    
    // Now the app has started!

官方给出vueRouter的实现的说明有4步:
<pre>
1.定义component
2.定义routes,什么是routes,就是由多个route组成的,而一个route中,一个path对应一个component,简而言之就是一个component和path的映射表
3.创建VueRouter实例,把定义好的routes作为参数。VueRouter的实例化做了什么另开一篇md,这篇只介绍router的install的过程。
4.把VueRouter实例注入到根组件中,也就是放在根组件的options中。
</pre>

那么现在来看看安装了`VueRouter`插件之后的根组件的实例化额外做了什么事情。

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
    }

### 根组件beforeCreate钩子 ###
根组件在实例化的时候,当运行`beforeCreate`钩子的时候,首先判断`$options`中是否存在router属性,根组件在第一次实例化的时候，由于手动传入了这个属性，因此只有根组件的实例化才有这个`router`属性,首先把根组件实例赋给`_routerRoot`,然后把`$options.router`给`this._router`,然后调用`VueRouter`实例的`init`方法,最后定义将`this._route`定义为响应式数据,它的值为`this._router.history.current`,最后`registerInstance(this, this)`;`VueRouter.init`做了什么另开一篇文章来分析,这篇文章只分析install的过程。
### 非根组件beforeCreate钩子 ###
对于非根组件,由于不存`$options.router`,因此它的`beforeCreate`只需要找到`$parent._routerRoot`,最后`registerInstance(this, this)`;
### registerInstance ###
registerInstance,上面说过,就是调用`parentVnode`中的`data`中是否有`registerRouteInstance`,如果有就调用。现在要注意的是这个方法只在`router-view`的`vnode.data`中存在，换句话说，这句话就是针对`router-view`的初始化。

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

这个方法在`router-view`生成的`vnode`中存在,而在`router-link`中是不存在的,因此该方法主要是针对`router-view`,可以看到上面的方法就是在`matched.instances[name]`中赋值存放vue实例。
### destroyed ###

    destroyed () {
      registerInstance(this)
    }
区别于`beforedCreate`,`destroyed`方法只传入一个参数，这个方法还是调用上面的`registerRouteInstance`函数，该函数如果第二个参数不传也就是`val`的值为`undefined`,同时满足`current===vm`，最后的结果就是把`undefined`赋值给`matched.instances[name]`,也就达到了的销毁的作用。继续往下看

     Object.defineProperty(Vue.prototype, '$router', {
    	get () { return this._routerRoot._router }
      })
    
    Object.defineProperty(Vue.prototype, '$route', {
    	get () { return this._routerRoot._route }
      })
    
      Vue.component('router-view', View)
      Vue.component('router-link', Link)
    strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created

如上面的代码，将`Vue.prototype.$router`代理到`this._routerRoot._router`和`Vue.prototype.$route`代理到`return this._routerRoot._route`,`$route`表示当前路由信息，`$router`表示整个路由对象，全局注册2个组件，`router-view`和`router-link`,然后把`beforeRouteEnter`,`beforeRouteLeave`,`beforeRouteUpdate`组件的3个钩子的合并策略跟`strats.created`一样,也就是说这个3个路由的钩子就是按照正常的钩子的合并策略。
