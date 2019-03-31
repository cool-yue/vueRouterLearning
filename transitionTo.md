`transitionTo`这个方法，之前在`base`类里面基本上过了一遍，没有特别去解释为原理性的东西，这篇MD，主要着重分析`transitionTo`具体是如何能够跳转路由的。
## 整体逻辑 ##
下面理一下`transitonTo`中一共涉及到哪些方法。它们分别是`match`,`confirmTransition`,`updateRoute`,`ensureURL`,`isSameRoute`,`resolveQueue`,`extractLeaveGuards`,`extractUpdateHooks`,`resolveAsyncComponents`,`runQueue`这几个方法。下面来从运行开始，一顺分析。
## transitonTo ##
`transitionTo`和`push`一样接受3个参数，调用的是`push`,最终执行的`transtionTo`,其中`push`的参数也经历过包装，具体可以看`hashHistory`的实现。首先看`transitionTo`和`push`它们的参数有什么不同。

      push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
	    // 后期的push
	    // 也是调用的transitionTo方法,第二个参数依旧是个函数
	    // 操作主要是window.location.hash = xxx,有历史记录,如果onComplete传入了就调用
	    this.transitionTo(location, route => {
	      pushHash(route.fullPath)
	      onComplete && onComplete(route)
	    }, onAbort)
      }
可以看到除了`onComplete`的参数经历过包装，其余的并没有什么变化，这个`onComplete`就是插入了如何处理这个`location`的操作，到底是`pushHash`还是`ReplaceHash`,同时第二个参数预期传入`route`作为函数的参数。这是从`push`方法传入到`transitionTo`包装的第一次。后面从`transtionTo`到`confirmTransition`还有第二次封装和改造，下面来看看，封装了什么，改造了什么。改造了`location`参数，该参数变成了`route`，也就是`match函数`返回的对象。包装了`onComplete`，在该函数之前加入了`this.updateRoute(route)`,在它之后加入了`this.ensureURL()`,并且还有处理`readyCbs`的过程。包装了`onAbort`,针对该函数预期传入一个`err`对象，然后调用`onAbort(err)`,如果`read`是false,还会处理一票`readyErrorCbs`，将该数组中的所有回调逐个运行。如下代码

	
	    this.confirmTransition(route, () => {
	      this.updateRoute(route)
	      onComplete && onComplete(route)
	      this.ensureURL()
	
	      // fire ready cbs once
	      if (!this.ready) {
	        this.ready = true
	        this.readyCbs.forEach(cb => { cb(route) })
	      }
	    }, err => {
	      if (onAbort) {
	        onAbort(err)
	      }
	      if (err && !this.ready) {
	        this.ready = true
	        this.readyErrorCbs.forEach(cb => { cb(err) })
	      }
	    })
	  }

上面有2次封装和改造，后面的函数基本都是线性执行了。下面分析这个过程。

    const route = this.router.match(location, this.current)
    // 这个location可以是一个字符串，也可以是Location对象类型，通常情况下
    // 比较简单地调用形式是this.$router.push("/aaa/bbb");
    // 在初始化的时候，this.current是一个path为'/'的route对象
下面分析`match`处理这个`location`后变成了什么。
## this.router.match ##
首先标准化Location，假如这里`location`是字符串。

    const location = normalizeLocation(raw, currentRoute, false, router)
    // 拿到location中的name的属性
    const { name } = location

    比如"/aaa/bbb/ccc?abc=1#/aaa",那么最终返回的是
    {
	    path："/aaa/bbb/ccc",
	    query:{abc:1},
	    hash:"#/aaa"
    }
如果这个`name`存在和不存在逻辑上差别很大，这里先假定不存在,那么就会运行下面的代码:

      // 如果location.path存在
      // location.params ={} 先初始化一个对象
      // 然后遍历pathList
      // 如果匹配到了就创建Route
      location.params = {}
      for (let i = 0; i < pathList.length; i++) {
        const path = pathList[i]
        const record = pathMap[path]
        // 遍历pathList中的每个path
        // 然后执行matchRoute,取出每个pathMap中对应path的record
        // record中存有regex,components,instances
        if (matchRoute(record.regex, location.path, location.params)) {
          return _createRoute(record, location, redirectedFrom)
        }
      }
这里需要执行`matchRoute`和`_createRoute`，现在看`matchRoute`。
## match->matchRoute ##
首先它的执行方式是`matchRoute(record.regex, location.path, location.params)`,它传入了3个参数。下面来看看如何`match`,第一个参数是个正则表达式，第二个参数是用户传入的`path`，第三个是`location.params`，它目前是一个空对象。首先通过`path.match(regex)`来把`regex`匹配的东西过滤出来，如果没有东西过滤出来,直接`return false`,这时候假定m已经过滤出来，下面来看看，后面怎么处理这个m，m是匹配后的数组，而regex.keys是参数中的键，最后将键和值一起放入params中,最后返回true，那么这个时候`params`中的属性就可以用了,代码如下:
    
    比如path是"/:username/:id",它对应的regex.keys为[{name:"username"},{name:"id"}]
    这时候假如传入的path是/aaa/15,那么m就是["aaa","15"]
    最终生成的params对象为{username:"aaa",id:"15"}
    
    function matchRoute (
      regex: RouteRegExp,
      path: string,
      params: Object
    ): boolean {
      // 判断传入的path是否能够匹配传入的regex正则
      const m = path.match(regex)
      // 如果不匹配就返回false
      if (!m) {
    	return false
      } else if (!params) {
    // 如果连参数都没有,直接返回true
    	return true
      }
      // 遍历regex.keys
      // 最后把参数中的属性替换成匹配到的值
      for (let i = 1, len = m.length; i < len; ++i) {
	    const key = regex.keys[i - 1]
	    const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i]
	    if (key) {
	      params[key.name] = val
	    }
      }
      // 返回true
      return true
    }

以上代码执行完后，会执行`_createRoute` 。
## match->_createRoute ##
`_createRoute`在`location`中不存在`name`的情况下，有2种调用方式，一种是没有match到`_createRoute(null, location)`，一种是match到`_createRoute(record, location, redirectedFrom)`,下面来看看`_createRoute`里面是什么。

      // 创建Route
    
      function _createRoute (
	    record: ?RouteRecord,
	    location: Location,
	    redirectedFrom?: Location
      ): Route {
	    // 存在record.redirect
	    // 执行redirect
	    if (record && record.redirect) {
	      return redirect(record, redirectedFrom || location)
	    }
	    // 存在matchAs就执行alias
	    if (record && record.matchAs) {
	      return alias(record, location, record.matchAs)
	    }
	    // 前面都不存在就执行createRoute
	    return createRoute(record, location, redirectedFrom, router)
      }

可以看到只要`record`里面没有`redirect`和`matchAs`那么就会执行`createRoute(record, location, redirectedFrom, router)`。
## match->_createRoute ->createRoute##
    // 创建一个route对象
    // 具体看route的type script
    // 基本就是把location里面的一些属性拿出来重新组织成一个route对象
    // 最后将这个对象进行冻结
    export function createRoute (
      record: ?RouteRecord,
      location: Location,
      redirectedFrom?: ?Location,
      router?: VueRouter
    ): Route {
      const stringifyQuery = router && router.options.stringifyQuery
      const route: Route = {
	    name: location.name || (record && record.name),
	    meta: (record && record.meta) || {},
	    path: location.path || '/',
	    hash: location.hash || '',
	    query: location.query || {},
	    params: location.params || {},
	    fullPath: getFullPath(location, stringifyQuery),
	    matched: record ? formatMatch(record) : []
      }
      if (redirectedFrom) {
    route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery)
      }
      return Object.freeze(route)
    }
可以看到最后通过这个`location`生成一个`route对象`,运行到这里，`match`函数执行完毕,`match`函数转化了第一个参数`location`,后面2个函数参数的包装，上面已经提过了，下面来分析执行`confirmTransition`的过程。
##transitionTo-> confirmTransition ##
在`confirmTransition`的过程中，函数内部将`onAbort`又包装了成了一个函数。如下：

    // confirmTransition调用的方式
    confirmTransition (route: Route, onComplete: Function, onAbort?: Function)

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
可以看到`onabort`执行之前，先判断包装函数`abort`传入的参数是否是`err`对象，如果是`err`对象那么就去`errorCbs`调用所有的回调函数。最后运行`onAbort`。继续往下看:

    if (
      isSameRoute(route, current) &&
      // in the case the route map has been dynamically appended to
      route.matched.length === current.matched.length
    ) {
      this.ensureURL()
      return abort()
    }

如果`isSameRoute`返回`true`，并且`route.matched.length === current.matched.length`,然后调用`this.ensureURL()`,这里的意思就是`push`的路径跟当前的路径是一样的，那么就把当前的`url`执行`replace`操作,然后`abort()`,表示这里并没有实际的导航到目标组件。下面看看`isSameRoute`的判断机制。
##transitionTo-> confirmTransition -> isSameRoute##
`isSameRoute`判断2个路由，几个关键属性要一样，并且值也要一样。代码如下:

	// 判断a和b是否是同一个route
	// 通常第一个传入的是用户push的
	// 第二个是current的
	export function isSameRoute (a: Route, b: ?Route): boolean {
	  // 如果current是start,也就是根路径
	  if (b === START) {
	    // 那么直接返回a===b,也就是比较2个对象是否完全一样
	    return a === b
	  } else if (!b) {
	    // 如果没有current
	    // 返回false
	    return false
	  } else if (a.path && b.path) {
	    // 如果a.path和b.path都有,但是b又不是根路径
	    // 这个时候,先去掉path结尾的'/'
	    // 然后看这2个字符串是否相等
	    // a.hash是否等于b.hash
	    // 最后判断a.query的值是否等于b.query
	    return (
	      a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') &&
	      a.hash === b.hash &&
	      isObjectEqual(a.query, b.query)
	    )
	  } else if (a.name && b.name) {
	    // 走到这里表示没有path,但是有a,b同时有name
	    return (
	      // 这里就要满足一下4个条件
	      a.name === b.name &&
	      a.hash === b.hash &&
	      isObjectEqual(a.query, b.query) &&
	      isObjectEqual(a.params, b.params)
	    )
	  } else {
	    // 走到这里返回false
	    return false
	  }
	}

上面条件为`true`的同时，还需要`route.matched.length === current.matched.length`,这个`matched`表示沿着这个`path`，存在的`vue组件`

    // 打比方,比如路径为/aaa/bbb/ccc对应3个组件record,AAA,BBB,CCC
    // 那么path为/aaa/bbb/ccc的matcher为[AAA,BBB,CCC]

如果这2个条件都满足了，那么ok，不需要导航，当不满足的时候，继续往下看。

    const {
      updated,
      deactivated,
      activated
    } = resolveQueue(this.current.matched, route.matched)

如上所示将`this.current.matched`(当前路由)和`route.matched`(即将转到的路由)，这是2个按照父到子，装有`record`的数组，来看看`resolveQueue`做了什么逻辑。

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

逻辑是找`current`和`next`中不一样的组件，举个例子:

    current:[A,B,C,D]
    next:[A,B,E]
    遍历current和next2个数组，当遍历索引到2的时候，发现C!==E,因此循环结束，此时i=2，那么可以知道在索引为2以前的`record`是相等的，从索引2开始（包含）的record就不相等了，最后生成的对象是
    
    {
	    upadted:[A,B]
	    activated:[E]
	    deactivated:[C,D]
    }
    这3个数组，分别存有路由公共的组件，和需要激活的新组件，和需要失活的旧组件。

继续往下执行，准备制造一个`queue`,运行队列，如下所示。

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

如上代码，可以看到在`deactivated`这个数组中，抽取出`leaveGuards`,然后拼接上全局的`beforeHooks`,然后在`updated`中抽取组件内的`updateHook`,然后再拿到`activated`中的`beforeEnter`,最后再在`activated`中处理异步组件，这个顺序基本上就是从离开`current`到`next`的过程中所有经历的钩子和guard。继续往下看。

	this.pending = route；

将`route`赋值给`this.pending`,然后定义一个`iterator`。这个`iterator`接受2个参数，一个是`guard`,一个是`next`,首先判断如果`this.pending !== route`那么表示即将进入的路由跟传入的路由不一致，那么就`abort()`,如果相等，就会将后续代码放在`try-catch`中，在该`try-catch`中执行`hook`,注意到每一个`guard`的三个参数都接受3个，按照官方给的说明如下：

	to:Route:the target Route Object being navigated to.
	from:Route:the current route being navigated away from.
	next:Function:this function must be called to resolve the hook.

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

前面2个参数，没有疑问，无非就是被导航到的`route`，和当前的`route`，第三个参数的函数也就是`next`这里分析一下`next()`的过程。如果`to`传入的是`false`,或者`to`是`error`对象，那么通过`this.ensureURL(true)`来保证`url`变回之前的`from`的`url`,然后中止导航，调用abort。如果`to`传入的是字符串，或者是拥有`path`或者`name`的对象,那么也会中止导航操作，如果传入的对象存在`replace`就调用`this.replace`否则调用`this.push`,其余的情况就是就是调用`next(to)`,`iterator`方法会用在`runQueue`中，作为第二个参数传入，`queue`作为第一个参数传入,下面来看看`runQueue`的逻辑。

    function runQueue (queue: Array<?NavigationGuard>, fn: Function, cb: Function) {}

runQueue3个参数，前面2个上面已经说够，第三个后面分析，先看`runQueue`内部的逻辑,在`runQueue`中又定义了一个方法，叫`step`,接受一个`index`作为参数,当`index >= queue.length`的时候，调用`cb()`,除此之外，取出`queue[index]`,这里表示某一个`guard`函数，然后通过把该`guard`传入`fn`，然后回调继续调用`step(index+1)`,当所有的回调全部执行完成后调用第三个参数传入的函数`cb`,代码如下。

	function runQueue (queue: Array<?NavigationGuard>, fn: Function, cb: Function) {
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

下面看看在调用`runQueue`时候第三个参数,第三个参数是当`queue`中的所有钩子全部执行完毕后调用,下面看看这个回调的过程。

	() => {
	      // 创建一个postEnterCbs空数组
	      const postEnterCbs = []
	      // 定义个函数,这个函数返回this.current === route
	      const isValid = () => this.current === route
	      // wait until async components are resolved before
	      // extracting in-component enter guards
	
	      // 在actived,postEnterCbs,isValid抽取出enterGuards
	      const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid)
	
	      // enterGuards再拼接this.router.resolveHooks
	      // 组成成新的queue
	      const queue = enterGuards.concat(this.router.resolveHooks)
	
	      // 拿到queue之后,这里的queue已经是属于post,也就是后置的钩子
	      // 在进入到目标组件后的钩子
	      // 将这个队列进行runQueue
	      // queue清理完后,将this.pending = null
	      // 最后将route传入onComplete
	      // 然后再$nextTick执行 postEnterCbs.forEach(cb => { cb() })
	      runQueue(queue, iterator, () => {
	        if (this.pending !== route) {
	          return abort()
	        }
	        this.pending = null
	        onComplete(route)
	        if (this.router.app) {
	          this.router.app.$nextTick(() => {
	            postEnterCbs.forEach(cb => { cb() })
	      }
如上面代码`postEnterCbs`顾名思义就是后置回调，`activated`这个数组里面，装的是新鲜的路由钩子,在这个新鲜的路由钩子调用`extractEnterGuards`抽取出`beforeRouteEnter`然后在抽取出`resolveHooks`,这个`resolveHooks`可能是官方预留的接口，并没有看到api中提到这个,然后将这些钩子按顺序拼接在一起，最后形成一个`queue`，上一轮的`runQueue`主要是清理`leave`钩子，回调的`runQueue`清理`beforeEnter`的钩子，最后在所有这些钩子都执行完毕的时候`onComplete(route)`,然后再用nextTick去执行一遍`postEnterCbs`。总而言之，`transitionTo`的代码很多都是处理钩子的顺序，最后贴一下官方给的顺序执行表，如下：


    The Full Navigation Resolution Flow
    Navigation triggered.
    Call leave guards in deactivated components.
    Call global beforeEach guards.
    Call beforeRouteUpdate guards in reused components.
    Call beforeEnter in route configs.
    Resolve async route components.
    Call beforeRouteEnter in activated components.
    Call global beforeResolve guards.
    Navigation confirmed.
    Call global afterEach hooks.
    DOM updates triggered.
    Call callbacks passed to next in beforeRouteEnter guards with instantiated instances.

## 总结 ##