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
可以看到最后通过这个`location`生成一个`route对象`,运行到这里，`match`函数执行完毕.


##transitionTo-> confirmTransition ##