使用`VueRouter`需要事先定义一个从path映射到component的routes对象,并把该对像作为参数传入`VueRouter`构造函数来进行实例化,`this.$router.push`这一类的方法都是`VueRouter`对象的方法,因此操作路由,实际上就是操作注入根组件的`VueRouter`的实例，下面来分析`VueRouter`这个类和它的各种逻辑。
## VueRouter类的各种属性 ##

      app: any;
      apps: Array<any>;
      ready: boolean;
      readyCbs: Array<Function>;
      options: RouterOptions;
      mode: string;
      history: HashHistory | HTML5History | AbstractHistory;
      matcher: Matcher;
      fallback: boolean;
      beforeHooks: Array<?NavigationGuard>;
      resolveHooks: Array<?NavigationGuard>;
      afterHooks: Array<?AfterNavigationHook>;
以上是VueRouter类的属性。

## VueRouter类的构造函数 ##
vueRouter的构造函数，传入的是一个route集合，这个route就是一个path对应一个组件。


    const User = {
      template: '<div>User {{ $route.params.id }}</div>'
    }
    
    const router = new VueRouter({
      routes: [
    	{ path: '/user/:id', component: User }
      ]
    })
通常情况下,new一个VueRouter一般都是如上面这样，options中有一个叫routes的属性。

    this.app = null
    this.apps = []
    this.options = options
    this.beforeHooks = []
    this.resolveHooks = []
    this.afterHooks = []
    // 默认是hash模式
    let mode = options.mode || 'hash'
如上面给这些变量的初始化较为简单，注意`mode`的默认模式是hash。history和matcher较为复杂，先看matcher,matcher对象是一个将定义好的路由集合进行收集转化成一条可用的record，这几个集合分别是`pathList`，`pathMap`，`nameMap`，具体看createMatcher专门的文档。

    this.matcher = createMatcher(options.routes || [], this)
再来看history的初始化

    // history对象有3个实现类，分别是HTML5History,HashHistory,AbstractHistory,具体看History文档
    switch (mode) {
      case 'history':
        this.history = new HTML5History(this, options.base)
        break
      case 'hash':
        // 生成一个history对象
        // 这个对象上,history.router = this
        // this.current = START,start是一个path为'/'的record
        this.history = new HashHistory(this, options.base, this.fallback)
        break
      case 'abstract':
        this.history = new AbstractHistory(this, options.base)
        break
      default:
        if (process.env.NODE_ENV !== 'production') {
          assert(false, `invalid mode: ${mode}`)
        }
    }
执行到这里constructor的代码已经执行完成了，继续往下看。
## match ##
	  match (
	    raw: RawLocation,
	    current?: Route,
	    redirectedFrom?: Location
	  ): Route {
	    return this.matcher.match(raw, current, redirectedFrom)
	  }
match主要是调用matcher中的match方法。
## get currentRoute ##
	  get currentRoute (): ?Route {
	    return this.history && this.history.current
	  }
拿到 this.history.current。
## init ##
init方法在install的时候也会执行。init接收一个vue实例作为参数，由于前面已经执行了构造函数里面的代码，所以有`this.apps = []`,所以首先将参数app压入这个数组，判断`this.app`是否存在，如果存在，表示已经初始化好了，当然没有初始化好，就`this.app = app`,这样下一次就成为了初始化好的状态，然后拿到`this.history`,如果history是`HTML5History`实例，或者是`HashHistory`的实例，分别进行各自的`transitionTo`,最后执行history.listen并把函数传入,这个函数遍历所有的app,然后将`app._route=route`,这个`route`是回调函数的参数。具体见下面的代码。
	  init (app: any /* Vue component instance */) {
	    process.env.NODE_ENV !== 'production' && assert(
	      install.installed,
	      `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
	      `before creating root instance.`
	    )
	    // vue-router的apps属性,它是一个数组
	    // 把根组件压进去
	    this.apps.push(app)
	
	    // main app already initialized.
	    if (this.app) {
	      return
	    }
	    // this.app 指向root组件
	    this.app = app
	    
	    const history = this.history
	
	    if (history instanceof HTML5History) {
	      history.transitionTo(history.getCurrentLocation())
	    } else if (history instanceof HashHistory) {
	      const setupHashListener = () => {
	        history.setupListeners()
	      }
	      history.transitionTo(
	        history.getCurrentLocation(),
	        setupHashListener,
	        setupHashListener
	      )
	    }
	
	    history.listen(route => {
	      this.apps.forEach((app) => {
	        app._route = route
	      })
	    })
	  }
## guard前奏 ##
导航需要在所有的hooks都resolve之后了才会执行，否则处于pending状态。<br/>
定义在vueRouter上面的称为全局guard，为什么是全局呢，基本上整个app就这一个router实例，因此定义在这个router上面的guard全局都有效，对比而言在组件内定义的钩子，只对当前组件有效，因此vue的官方叫`in-component guard`,组件内守卫，同时每个guard都接受3个参数，`to`，`from`,`next`,其中前2个参数是`Route`对象，什么是`Route`对象，就是定义在`Routes`集合中的每个元素，如下所示:
    export interface Route {
      // 一个为当前路由的字符串，总是将这个处理成为绝对路径
      path: string;
      // 这个name字段为选择性的，如果有，它就是当前路由的name
      name?: string;
      // 当前路由的hash,注意是包含了#的hash
      hash: string;
      // 一个包含了键值对的queryString比如/foo?user=1,我们拿到的是$route.query.user == 1,如果没有query，这里将会是一个空对象
      query: Dictionary<string>;
      //一个包含了键值对的对象，表示的是动态片段和星花片段，如果没有参数就是个空对象
      params: Dictionary<string>;
      //完全处理后的path，包括了query和hash
      fullPath: string;
      matched: RouteRecord[];
      // 重定向路由的名字
      redirectedFrom?: string;
      // meta元数据
      meta?: any;
    }
`to`是正要导航到的目标路由，`from`是当前路由并且即将被导航离开这个路由，`next`是一个function，这个方法必须被调用来终结当前这个hook，next执行的行为是依赖于传给`next`的参数。下面看看`next`的函数的几个方式:
<pre>
next():移到下一个pipeline的钩子，如果没有别的钩子了，这一次导航就确定了。
next(false):中断当前的导航，如果浏览器的URL已经变了，不管是通过后退还是人工改的，都会被重置到`from`的route。
next('/') or next({path:'/'}):重定向到一个不同的location。当前导航将要被中断，并且一个新的导航会开始。可以传任何的`location`对象到`next`中，这些参数可以指定一些选项，比如replace：true，name：'home'和任何已经在route-link的to中或者`router`的`push`中使用的options，至于`location`对象是什么后面来描述。
next(error):如果参数被传入到next中是Error的实例，导航会中断并且错误会被传进注册的callbacks中，通过router.onError();
</pre>
下面来看看前面说的`Location`是什么,首先前面提到了`Location`中的参数实际上就是与`psuh`和`router-link`的`to`等效:

	export interface Location {
	  // 这个就是route的name
	  name?: string;
	  // 同route的path
	  path?: string;
	  // 同route的hash
	  hash?: string;
	  // 同route的query
	  query?: Dictionary<string>;
	  // 同route的params
	  params?: Dictionary<string>;
	  // 标志位,标志是否会基于某个path来进行路径的插入
	  // 如果没设置这个,就是从/a到/b
	  // 设置了之后就是/a到/a/b
	  append?: boolean;
	  // 如果设置了replace就是替换就是调用router.push
	  replace?: boolean;
	}

## beforeEach ##
      this.beforeHooks = [] // 初始化的时候
	  beforeEach (fn: Function): Function {
	    return registerHook(this.beforeHooks, fn)
	  }
如上面代码所示基本上beforeEach的全局方法，接受一个函数作为参数，同时也返回一个函数本质上是调用了`registerHook`。基本思路就是把`fn`压入到`this.beforeHooks`中。
## beforeResolve ##
     this.resolveHooks = [] //初始化的时候
	 beforeResolve (fn: Function): Function {
	    return registerHook(this.resolveHooks, fn)
	 }
同上本质上是调用`registerHook`。把fn压入到`this.resolveHooks`数组中。
## afterEach ##
      this.afterHooks = [] // 初始化的时候
	  afterEach (fn: Function): Function {
	    return registerHook(this.afterHooks, fn)
	  }
同上本质上是调用`registerHook`。把fn压入到`this.afterHooks`数组中。
## onReady ##
	  onReady (cb: Function, errorCb?: Function) {
	    this.history.onReady(cb, errorCb)
	  }
调用history的onReady方法。
<pre>
这个方法把一个回调放入一个队列，当router已经完成初始化的导航后调用，这意味着它处理了所有的与初始化route相联系的异步的enter hooks和异步的组件。这个在服务器端渲染非常有用，保证了在服务器和客户端都有持久的输出。
</pre>
## onError ##
	  onError (errorCb: Function) {
	    this.history.onError(errorCb)
	  }
调用history的onError方法。
注册一个回调，当在进行路由导航的过程中捕获到错误的时候，就会调用，必须是以下这几种情况:
<pre>
1.在一个route guard函数中被同步地抛出来。
2.在一次route guard函数中被捕获，并且异步控制通过next(err)
3.当需要渲染一个route的时候，同时尝试着处理一个异步的组件，这个时候出现错误。
</pre>
## push ##
就是调用history的push。
## replace ##
就是调用history的replace。
## go ##
就是调用history的go。
## back ##
调用go（-1）
## forward ##
调用go（1）
## getMatchedComponents ##
## resolve ##
处理某个location对象，location对象上面有提到，最后返回一个对象。首先调用`normalizeLocation`来处理`(to,current || this.history.current,append,this)`这几个参数，拿到一个标准化后的location对象，然后调用`this.match`将location和current作为参数得到一个route，拿到这个route后，继续拿到这个route的`redirectedFrom`和`fullPath`，同时拿到`this.history.base`,通过`base`，`fullPath`，`this.mode`三个参数来创建出一个`href`,最后return一个处理过的东西的对象,具体代码如下。
	
	  resolve (
	    to: RawLocation,
	    current?: Route,
	    append?: boolean
	  ): {
	    location: Location,
	    route: Route,
	    href: string,
	    // for backwards compat
	    normalizedTo: Location,
	    resolved: Route
	  } {
	    const location = normalizeLocation(
	      to,
	      current || this.history.current,
	      append,
	      this
	    )
	    const route = this.match(location, current)
	    const fullPath = route.redirectedFrom || route.fullPath
	    const base = this.history.base
	    const href = createHref(base, fullPath, this.mode)
	    return {
	      location,
	      route,
	      href,
	      // for backwards compat
	      normalizedTo: location,
	      resolved: route
	    }
	  }
## addRoutes ##
	  // 接受一个routes对象
	  // 调用matcher的addRoutes(routes)
	  // 如果当前的与START不相等
	  // 就调用history.transitionTo(this.history.getCurrentLocation());
	  addRoutes (routes: Array<RouteConfig>) {
	    this.matcher.addRoutes(routes)
	    if (this.history.current !== START) {
	      this.history.transitionTo(this.history.getCurrentLocation())
	    }
	  }
## 其他工具方法 ##
### registerHook ###
	// registerHook接受2个参数
	// 一个是数组,一个是函数
	// 将第二个参数push到第一个数组中
	// 返回一个函数,list和fn组成闭包
	// 拿到list.indexOf(fn)的索引然后把fn从list中删除
	// 这里典型的发布订阅模式
	function registerHook (list: Array<any>, fn: Function): Function {
	  list.push(fn)
	  return () => {
	    const i = list.indexOf(fn)
	    if (i > -1) list.splice(i, 1)
	  }
	}
### createHref ###
	// 创建href
	// 这个函数接受3个参数,base,fullPath,mode
	// 如果mode是hash模式,也就是说url里面需要有#
	// 那么就在fullPath前面加#
	// 如果有base就在path前面加base,并且将//转化为/
	function createHref (base: string, fullPath: string, mode) {
	  var path = mode === 'hash' ? '#' + fullPath : fullPath
	  return base ? cleanPath(base + '/' + path) : path
	}
## 直接执行的代码 ##
    VueRouter.install = install
    VueRouter.version = '__VERSION__'
    
    if (inBrowser && window.Vue) {
      window.Vue.use(VueRouter)
    }
    
