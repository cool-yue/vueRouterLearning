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
onReady
onError
transitionTo
confirmTransition
## HashHistory ##
## HTML5History ##
## AbstractHistory ##