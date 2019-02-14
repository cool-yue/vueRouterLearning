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
中文直译确认转移，接收3个参数，第一个参数为route，第二个参数为onComplete的回调，第三个参数为onAbort的回调，也就是成功转以后的回调，和转移失败的回调。下面分析一下这其中的过程。首先拿到`this.current`。
    
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
将`current.matched`和`route.matched`传入resolveQueue，拿到updated，deactivated，activated。

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
    

## HashHistory ##
## HTML5History ##
## AbstractHistory ##