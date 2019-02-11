createMatcher是初始化VueRouter对象的其中的一个环节。同样Matcher也是比较复杂过程。下面来看看这个过程。
createMatcher接受2个参数,第一个是routes对象,第二个是vueRouter对象。然后来看看

    const { pathList, pathMap, nameMap } = createRouteMap(routes)
这里看看`createRouteMap`做了什么。`createRouteMap`返回一个对象，这个对象有3个属性，如下:

    {
      pathList: Array<string>;
      pathMap: Dictionary<RouteRecord>;
      nameMap: Dictionary<RouteRecord>;
    }

pathList是数组，pathMap和nameMap是对象。createRouteMap第一个参数接收一个routes对象，那么看看对routes做了什么。

      routes.forEach(route => {
    	addRouteRecord(pathList, pathMap, nameMap, route)
      })
遍历routes,然后调用addRouteRecord，前三个参数分别已经初始化为了数组和2个对象，最后一个参数为routes中某一条遍历的route，来看看addRouteRecord做了什么。

    const { path, name } = route
拿到一条记录的path和name，通常情况下name一般不传，但是path肯定会有。拿到path和name。然后运行下面:

    const normalizedPath = normalizePath(path, parent)

下面来看看如何标准化path，

    // 标准化的过程
    function normalizePath (path: string, parent?: RouteRecord): string {
      // 如果path以"/"结尾的这个斜杠将其去掉
      path = path.replace(/\/$/, '')
      // 替换完了之后
      // 如果第一个字符为'/'这个表示从根目录开始,所以不需要parent
      // 如果parent为null也返回
      // 如果parent不为null,就拼接一个parent.path
      if (path[0] === '/') return path
      if (parent == null) return path
      return cleanPath(`${parent.path}/${path}`)
    }
标准化的逻辑就是，如果path最后有`/`,那么就将其去掉，同时如果path第一个字符为`/`,那么就直接返回,因为表示这是从根路径开始,如果parent没有传表示没有parent,其余情况就是path的第一个字符不以`/`开头，同时又存在parent的话，那么运行到这里表示，parent.path和path需要组合成一个复合路径，也就是说存在children。cleanPath做了什么。就是把`//`换成一个`/`,整体来说还是标准化的过程。运行到这里标准化的path已经生成了,继续往下执行。

    const pathToRegexpOptions: PathToRegexpOptions = route.pathToRegexpOptions || {}
通常情况下pathToRegexpOptions并没有传,因此这里的细节先略过，继续往下执行。

    if (typeof route.caseSensitive === 'boolean') {
    	pathToRegexpOptions.sensitive = route.caseSensitive
      }
这里caseSensitive表示是否大小写敏感，通常来说这里也不会传，因此这里的细节先略过。继续往下执行，下面创建一个record，


      const record: RouteRecord = {
	    path: normalizedPath,
	    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),
	    components: route.components || { default: route.component },
	    instances: {},
	    name,
	    parent,
	    matchAs,
	    redirect: route.redirect,
	    beforeEnter: route.beforeEnter,
	    meta: route.meta || {},
	    props: route.props == null
	      ? {}
	      : route.components
	    ? route.props
	    : { default: route.props }
      }
创建了一个record对象，这个对象有已经标准化的path属性，存在regex属性，components属性，如果没有components，那么就用component，然后instances初始化为一个对象，name就是name，parent就是parent，matchAs就是matchAs，redirect为route的redirect，beforeEnter钩子，meta属性，props属性如果是null那么就初始化为{}，如果`routes.components`存在就使用`route.props`,如果不存在，就用`route.props`,继续往下执行:

    if (route.children) {
	    route.children.forEach(child => {
	      const childMatchAs = matchAs
	    	? cleanPath(`${matchAs}/${child.path}`)
	    	: undefined
	      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
	    })
    }