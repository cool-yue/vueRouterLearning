vueRouter自己管理了3个history实现类，它们分别是HashHistory，HTML5History，AbstractHistory，第一个对应的模式是"hash",第二个对应的模式是"history",第三个对应的模式是"abstract",通常情况下，主要是前面2种，下面分析这3种history实现类。这3个实现类有一个基类History。
## History ##
history是这3个类实现的基类，它指定了一些子类应该实现的方法。
### 属性 ###

      router: Router;// VueRouter对象实例
      base: string;
      current: Route;
      pending: ?Route;
      cb: (r: Route) => void;
      ready: boolean;
      readyCbs: Array<Function>;
      readyErrorCbs: Array<Function>;
      errorCbs: Array<Function>;
### 子类应该实现的方法 ###

      +go: (n: number) => void;
      +push: (loc: RawLocation) => void;
      +replace: (loc: RawLocation) => void;
      +ensureURL: (push?: boolean) => void;
      +getCurrentLocation: () => string;

### constructor ###

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
constructor接收2个参数，它们是VueRouter对象实例和一个base的字符串。router赋值给this.router,base通过normalizeBase来进行标准化然后赋值给base。其余的属性进行初始化。
### 方法 ###
### listen ###
listen接收一个function，将function赋值给this.cb

     listen (cb: Function) {
       this.cb = cb
      }

### onReady ###
onReady接收2个参数,一个是cb一个是errorCb,当`this.ready`为true的情况下调用cb()如果为false，就把cb压入`this.readyCbs`,如果存在errorCb，就将该函数压入`this.readyErrorCbs`。

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

### onError ###
onError简单来说就是把errorCb压入this.errorCbs

    onError (errorCb: Function) {
        this.errorCbs.push(errorCb)
    }

### transitionTo ###
transitionTo接收3个参数，其中第一个是必须传，第二个和第三个是选择传。首先通过router对象的match方法匹配location和`this.current`
### confirmTransition ###

    confirmTransition (route: Route, onComplete: Function, onAbort?: Function) {}
中文直译确认转移，接收3个参数，第一个参数为route，第二个参数为onComplete的回调，第三个参数为onAbort的回调，也就是成功转移后的回调，和转移失败的回调。下面分析一下这其中的过程。首先拿到`this.current`。
    
    const current = this.current
定义一个abort的函数,这个函数首先判断传入的对象是满足isError条件，如果满足将errorCbs里面的存入的函数进行遍历地执行，并且传入err对象，如果传入了onAbort那么还会执行onAbort。

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
如果route和current是一样的，并且matched的长度也是一样的，那么就执行ensureURL()然后执行abort()，然后返回。如果不一样，就继续往下执行。

      const {
        updated,
        deactivated,
        activated
      } = resolveQueue(this.current.matched, route.matched)
将`current.matched`和`route.matched`传入resolveQueue，拿到updated，deactivated，activated。下面会生成一个队列，该队列装有5个类型的guard，代码如下，具体抽取的细节看源码注释：

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
queue生成后,将`route`赋值给`this.pending`,然后定义了2个函数，这2个函数分别是iterator和runQueue。下面看看这2个方法做了什么。
#### confirmTransition -> iterator ####
该方法接受2个参数，分别是hook和next，如果`this.pending !== route`,就中断,如果相等那么后面运行hook方法，传入3个参数，分别是route，current，和一个函数，这个函数接受一个参数`to`，下面看看这个函数的逻辑,该方法的逻辑是如果`to`为false，那么就中断，如果`to`为字符串，或者`to`为对象并且`to.path`或者`to.name`为字符串，那么就先调用`abort`然后，如果`to`是对象并且`to.replace`为true那么就调用`replace`，否者调用`push`，其余情况直接就调用`next(to)`,注意这里讲`to`传入了`next`作为参数。源码如下:

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

#### confirmTransition -> runQueue ####
`runQueue`接受3个参数，第一个参数为`queue`，第二个参数为`iterator`,第三个参数为一个方法，该方法的逻辑如下，首先创建一个空数组`postEnterCbs`,再定义一个`isValid`的方法，这个方法的判断逻辑是`this.current === route`,传入3个参数`activated`，`postEnterCbs`，`isValid`，抽取出`enterGuard`,然后再与`this.router.resolveHooks`组成一个队列，然后执行`runQueue`，传入`queue`,传入`iterator`,最后传入一个方法，这个方法的逻辑是，如果`this.pending !== route`就`abort()`,如果前面条件相等，那么将`this.pending = null`,运行`onComplete(route)`,最后判断如果`this.router.app`存在，使用app（vue根组件对象）的`$nexttick`来执行`postEnterCbs`中的函数，代码如下。

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

### updateRoute ###
更新路由,把route作为参数传入,把`this.current`给prev，把route赋值给`this.current`,如果存在cb就执行cb并且把route作为参数传入，遍历`this.router.afterHook`，遍历这个afterHook，把当前的route和上一次的route作为参数调用每一个钩子。

      updateRoute (route: Route) {
	    const prev = this.current
	    this.current = route
	    this.cb && this.cb(route)
	    this.router.afterHooks.forEach(hook => {
      		hook && hook(route, prev)
    	})
      }
分析到这里history的base类已经完成了，下面来看看，这里history引入的依赖方法。
## history基类的相关依赖函数 ##
### flatten ###
flatten函数接受一个数组，最后返回这个数组与[]的concat的结果，基本上可以认为是深拷贝。代码如下:

    export function flatten (arr: Array<any>): Array<any> {
      return Array.prototype.concat.apply([], arr)
    }
    
### flatMapComponents ###
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
    // components待了s是什么什么意思，顾名思义就是有多个组件在匹配同一个路由的时候渲染，看如下的例子
    <router-view class="view one"></router-view>
	<router-view class="view two" name="a"></router-view>
	<router-view class="view three" name="b"></router-view>
    const router = new VueRouter({
        routes:[{
            path:"/",
            components:{
                default:Foo,
                a:Bar,
                b:Baz
            }
        }]
    });
    //这也就是说，当一个template中存在多个router-view的时候，需要知道谁在哪里渲染，通过在router-view上面提供一个name属性来，同时在components中将这个name的值作为components中的键，这样就匹配上去了。
### resolveAsyncComponents ###

    function resolveAsyncComponents (matched: Array<RouteRecord>): Function {
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
    
### normalizeBase ###
该方法接受一个参数base,如果没传base，首先判断是否在浏览器环境，如果在的话，先拿到`<base>`标签的href值（这个标签放在head中，作为页面中所有资源的基础路径），如果没有就设置为`'/'`,最后将`https://`或者`http：//`替换掉，如果没有base标签也将base设置为`'/'`,最后得到的base，如果不是以`'/'`开头，就加上`'/'`,最后把结尾的`'/'`替换掉。

    function normalizeBase (base: ?string): string {
      if (!base) {
	    if (inBrowser) {
	      // respect <base> tag
	      const baseEl = document.querySelector('base')
	      base = (baseEl && baseEl.getAttribute('href')) || '/'
	      // strip full URL origin
	      base = base.replace(/^https?:\/\/[^\/]+/, '')
	    } else {
	      base = '/'
	    }
      }
      // make sure there's the starting slash
      if (base.charAt(0) !== '/') {
    	base = '/' + base
      }
      // remove trailing slash
      return base.replace(/\/$/, '')
    }

### resolveQueue ###
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

### extractGuard ###
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
这种extractGuard指定了函数的第二个参数，这个参数的是写在组件`options`中的`guard`钩子，`例如beforeRouterEnter`，`beforeRouterUpdate`，`beforeRouteLeave`，将第二个参数给一个这个字符串，第一个def为一个vue的构造函数或者`options`，无论怎样，通过extend都能将其转化为构造函数。
### bindGuard ###
    // bindGuard顾名思义就是绑定guard的上下文环境
    // 上下文环境就是instance
	function bindGuard (guard: NavigationGuard, instance: ?_Vue): ?NavigationGuard {
	      if (instance) {
	    	return function boundRouteGuard () {
	      		return guard.apply(instance, arguments)
	    	}
	      }
    }
### extractGuards ###

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
### extractLeaveGuards ###
	// 抽取出beforeRouteLeave,注意,它存在反转
	function extractLeaveGuards (deactivated: Array<RouteRecord>): Array<?Function> {
	  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
	}
### extractUpdateHooks ###
	// 抽取出beforeRouteUpdate
	function extractUpdateHooks (updated: Array<RouteRecord>): Array<?Function> {
	  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
	}
### extractEnterGuards ###
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
### bindEnterGuard ###
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
### poll ###
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


#总结
写到这里，history的base类就已经完了，下面来看看扩展类。
