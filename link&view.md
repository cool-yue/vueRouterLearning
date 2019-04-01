使用路由的功能的前提首先是要有路由对象，其次路由要有出口，也就是<route-view>,这里分析一下vue-router的2个组件，一个是link一个是view，首先link在一般情况下，都可以用router.push这种形式去“程序化”这个link的功能，下面先分析这个view的功能。
## router-view铺垫##
router-view是一个函数式组件,表示这个组件并没有自己的视图和状态，而是通过一定的逻辑，来渲染其他有状态有模板的组件。

      name: 'router-view',
      functional: true,
      props: {
    	// 接收一个name属性
    	// 表示router-view可以是具名组件
        name: {
          type: String,
          default: 'default'
        }
      }

如上所示，虽然name不是必须的，但是便于调试和便于vue内部取组件名，最好还是设置一下。functional属性设置为true，然后props属性，接受一个字符串类型的数据，默认为`'default'`。下面就是分析一下核心部件，render的逻辑。通常情况下，render接收的属性的标准形式是：

    render(h) {return h()}

因为在vue渲染的时候会把render这么来调用,也就是会给一个createElment给render。

    render.call(vm,$createElement)

这里由于是函数式组件，并不会把这个组件实例化，因此没有`this`的上下文可以用，但是在源码处理`functional`组件的时候，会把`context`给`render`作为第二个参数，可以把函数式组件理解成一个壳，所以它的render的定义是这样的：

    render(_,{props,children,paretn,data}) {}

实际上第二个参数这么定义，就是为了解构上下文中需要的属性。因为函数式组件并不会去初始化它的`data`，同时也不会存在组件实例，也就是上面的`vm`的上下文并不存在，从而`this`无从谈起，在vue的源码中，对于设置了`functional: true`的情况是这么来调用的：

      if (isTrue(Ctor.options.functional)) {
    	return createFunctionalComponent(Ctor, propsData, data, context, children)
      }

如上可以看到当Ctor.options.functional如果是true的话，就直接以`createFunctionalComponent`来处理这个组件了，下面来看看`createFunctionalComponent`具体做了什么，首先要知道，在调用这个方法的时候，已经传入了Ctor，propsData，data，context，children，5个属性，下面看看这个方法如何利用这5个属性。

      const props = {}
      const propOptions = Ctor.options.props
      if (isDef(propOptions)) {
    	for (const key in propOptions) {
      		props[key] = validateProp(key, propOptions, propsData || {})
    	}
      } else {
    	if (isDef(data.attrs)) mergeProps(props, data.attrs)
    	if (isDef(data.props)) mergeProps(props, data.props)
      }

如上面代码所示，首先处理props，通过`Ctor.options.props`可以知道`options`中是如何定义`props`，严格来说这里是为了知道`props`里面到底定义了哪些`key`，通过遍历这里面的`key`，然后从`propsData`中拿到对应的属性并且验证其合法性，如果用户并有定义`props`,那么就把`attr`和`props`全部merge到定义的props对象。

      const _context = Object.create(context)
      const h = (a, b, c, d) => createElement(_context, a, b, c, d, true)

接下来内部拿到createElement，并且拿到上下文，将上下文包装一下，变成一个新的对象的原型，然后createElement的第一个参数以这个上下文来占位。

      const vnode = Ctor.options.render.call(null, h, {
	    data,
	    props,
	    children,
	    parent: context,
	    listeners: data.on || {},
	    injections: resolveInject(Ctor.options.inject, context),
	    slots: () => resolveSlots(children, context)
      })

这里调用`options`中定义的`render`函数，由于之前我们是以上面的方式进行定义的，如下所示
    render(_,{props,children,paretn,data}) {}
对比上下的代码，在内部实际调用的过程中，第一个参数给了`h`，第二个参数给了`{data，props，children，parent，listeners，injections，slots}`，通过解构的思路，在调用的时候，没有上下文的对象，也能访问用户实际定义的`options`中的各种属性。说到这里，解释了为什么`函数式组件`可以这么来定义`render`。
## router-view render过程 ##
`render (_, { props, children, parent, data })`调用的过程中，设置`routerView `为true，同时拿到上下文环境的一些属性。
    const h = parent.$createElement
    const name = props.name
    const route = parent.$route
    const cache = parent._routerViewCache || (parent._routerViewCache = {})
如上拿到拿到`$createElement`,拿到`props`中的`name`，这个`name`是`router-vie`w的名称，通常渲染多组件的时候有用，拿到上下文中的`$route`,拿到上下文中的`_routerViewCache`,如果没有就创建一个新的对象。基本上这一系列的操作都是初始化做准备工作的过程。继续往下看。

    let depth = 0
    let inactive = false
    // 这里循环找parent,直到parent._routerRoot === parent
    // 也就是说找到根组件
    while (parent && parent._routerRoot !== parent) {
      if (parent.$vnode && parent.$vnode.data.routerView) {
        // 每循环一次如果$vnode.data.routerView存在
        // 那么depth就自增1
        depth++
      }
      // 如果parent._inactive为true
      // 那么inactive设置为true
      // parent只要有一个是inactive,表示已经失去活性
      if (parent._inactive) {
        inactive = true
      }
      // 将parent设置为parent的$parent进行下一次循环
      parent = parent.$parent

      //循环上面的过程,直到parent.$vnode.data._routerRoot === parent
    }
判断`depth`的层数，这个层数是判断当前的上下文到`_routerRoot`的层数，一直遍历到根节点，只要祖先中存在routerView这个字段那么就会自增1，这么做的原因在于，当多层次嵌套的时候，方便路由的层次匹配。（`_routerRoot`就根实例，在router的初始化能知道。）同时设置`_incative`，这个字段表示当前的组件被`keep-alive`了只是当前不显示而已，如果父组件中的`_inactive`为true,那么就设置`inactive = true`,因为父组件都不显示，子组件就更不会显示了。然后继续拿到`$parent`一层一层往上找。遍历完了之后，`depth`就已经设置好了，设置到`data.routerViewDepth`属性上。继续往下看。

    data.routerViewDepth = depth
    if (inactive) {
      return h(cache[name], data, children)
    }
    const matched = route.matched[depth]
    if (!matched) {
      cache[name] = null
      return h()
    }
如果`inactive`为true了，表示当前这个`router-view`并不会被渲染，直接返回`return h(cache[name], data, children)`,如果没有matched到，那么将这个`cache[name]`设置为`null`,然后返回一个空的h();如果匹配到了，继续往下执行。

    const component = cache[name] = matched.components[name]；
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
在data上面定义一个`registerRouteInstance`方法，这个方法的逻辑是:

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

上面的逻辑是，根据`depth`取出`route`中的`matched`对应的`matched`,然后拿到`matched.instances[name]`,这里默认`name`是'default',拿到对应的实例，然后在data上面定义一个`registerRouteInstance`,顾名思义就是注册`Route`组件，如果组件实例不相等，就将`matched.instances[name] = val`,说白了这里就是将实例放到`matched.instances`中。继续往下看。

    ;(data.hook || (data.hook = {})).prepatch = (_, vnode) => {
      matched.instances[name] = vnode.componentInstance
    }

在data上绑定一个`hook`,`hook`上面添加一个`prepatch`属性，将`vnode.componentInstance`放入到`matched.instances[name]`。赋值完之后，component,data,children都已经就位。最后

    return h(component, data, children)

运行到这里，`router-view`组件渲染完毕，下面总结一下`router-view`中`render`的过程到底并入了原生不具备的几个属性以及整个流程下来的思路。
1.router-view是函数式组件，render函数需要指定第二个参数，因为函数式组件虽然不是html的原生标签，但是它也不会产生一个vueInstance，因此没有自己的`this`上下文。
2.函数式组件很多信息就需要从render函数的第二个参数拿,从上面的源码分析中，可以知道第二个参数传入了一些参数，这些参数基本上能够拿到上下文的信息。
3.明确了1，2两点，下面来

## router-link ##
router-link组件