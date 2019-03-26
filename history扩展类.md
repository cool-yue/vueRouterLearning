分析了基类之后，下面来看看扩展类。通常默认情况下如果不明确设定，通常都是hashHistory的模式，所以首先分析hashHistory的模式。不管是哪个模式，路由转换的核心方法是transitionTo.
## base ##
基类的一些方法是需要下面这几个类去重写的他们是：

      // implemented by sub-classes
      +go: (n: number) => void;
      +push: (loc: RawLocation) => void;
      +replace: (loc: RawLocation) => void;
      +ensureURL: (push?: boolean) => void;
      +getCurrentLocation: () => string;

## HashHistory ##
针对以上的几个重写的方法，下面来分析`HashHistory`，初始化创建vueRouter在`new`一个`HashHistory`的时候，传入了了3个参数，分别是`this`(指向vueRouter实例),`options.base`,`this.fallback`。

    this.history = new HashHistory(this, options.base, this.fallback)

vueRouter最关键的2个属性一个是`matcher`一个是`history`。下面看看`HashHistory`的构造函数做了什么以及如何实现上面的几个方法。
## HashHistory -> constructor ##
首先调用 `super(router, base)`,然后如果有`fallback`就去调用`checkFallback`,然后就返回，如果没有`fallback`就调用`ensureSlash()`,这个方法是保证`hash`模式中`url`中的`hash`第一个字符是`/`。代码如下：

	constructor (router: Router, base: ?string, fallback: boolean) {
	    super(router, base)
	    // check history fallback deeplinking
	    // 如果fallback传入才会检查后面的
	    if (fallback && checkFallback(this.base)) {
	      return
	    }
	    // 确保有hash前面有/,如果没有就会加上/,然后替换
	    ensureSlash()
      }
可以看到`vueRouter`的代码非常简单，就是调用了`super`然后处理`fallback`,然后`ensureSlash`,构造函数执行完毕。
## HashHistory -> go ##
等同于window.history.go(n)

      // 等同于window.go
      go (n: number) {
    	window.history.go(n)
      }
## HashHistory -> push ##
通常使用router的时候，都是`this.$router.push`以这样的方式来使用，正好`hashHistory`里面也要实现对应的`push`,这2个`push`是不是一回事，下面来看看`vueRouter`类中定义的`push`方法。

      push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    	  this.history.push(location, onComplete, onAbort)
      }

通过以上代码可以看到`VueRouter`的方法push方法，实际上只是将`history.push`包装了一层，参数都是一模一样的，所以可以认为，`VueRouter`的`push`本质上是去执行`history.push`。下面来看看`history.push`在做什么事情。

      // 这里注意下push和replace的区别,由于push是进行的window.location.hash = xxx的操作
      // 这一系列的替换,都会压入到浏览器的history中
      // 而replace是通过window.location.replace,它不会产生历史记录
      // 这两个方法仅此区别
    
      push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
	    // 后期的push
	    // 也是调用的transitionTo方法,第二个参数依旧是个函数
	    // 操作主要是window.location.hash = xxx,有历史记录,如果onComplete传入了就调用
	    this.transitionTo(location, route => {
	      pushHash(route.fullPath)
	      onComplete && onComplete(route)
	    }, onAbort)
      }
基本上可以看到`push`方法只调用了一个方法，`this.transitionTo`,只是参数略微包装了一下。第一个参数一样，都是`location`,第二个参数是一个函数，它包装传入的`onComplete`,在`onComplete`之前插入了一个方法,`pushHash(route.fullPath)`,这个方法做的事情，就是替换当前的`url`中的`hash`。替换完之后再`oncomplete`。`transitionTo`这个方法写在了`base类`中,由于方法较为复杂，新开一篇MD来说明。
## HashHistory -> replace ##
replace方法同理，在`vueRouter`中也定义了，并且它的方法本质上也是调用的`history.replace`,replace的方法和`push`很像，只是把`pushState`换成了`window.location.replace`这个操作是直接换`url`最终不会把之前的`url`放到`history`中。具体看代码。
## HashHistory -> ensureURL ##
	  // 确保url
	  // 拿到this.current.fullPath,如果它们不等,看push是否置为true
	  // 如果是true就push不是就replace
	  ensureURL (push?: boolean) {
	    const current = this.current.fullPath
	    if (getHash() !== current) {
	      push ? pushHash(current) : replaceHash(current)
	    }
	  }
这个方法，就是保证，是不是`push`,如果不是`push`就使用`replace`,他们最终导致的结果是，替换前的`url`一个在历史中，一个不在历史中。
## HashHistory -> getCurrentLocation ##

	  // 通过window.location.hash切掉#和以前的字符串,拿到hash
	  getCurrentLocation () {
	    return getHash()
	  }
`getCurrentLocation`就是调用了`getHash`。
## HTML5History ##
## AbstractHistory ##
## 工具方法 ##
## 工具方法->ensureSlash ##
字面意思是保证有`/`,首先通过`window.location`拿到`hash`,然后拿到`hash`的第一个字符，如果字符是`/`,返回`true`,如果hash第一个字符不是`/`,那么就把`url`中的`hash`替换成带`/`的，然后返回`false`，代码如下：

    function ensureSlash (): boolean {
      // 如果hash是/开头
      // 就返回true
      const path = getHash()
      if (path.charAt(0) === '/') {
         return true
      }
    
      // 把url换成/xxxx/xxxx/xxxx#/xxx
      // 返回false
      replaceHash('/' + path)
      return false
    }