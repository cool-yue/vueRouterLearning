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
执行到这里constructor的代码已经执行完成了，下面看看VueRouter类中的