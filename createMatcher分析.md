createMatcher是初始化VueRouter对象的其中的一个环节。同样Matcher也是比较复杂过程。下面来看看这个过程。
createMatcher接受2个参数,第一个是routes对象,第二个是vueRouter对象。然后来看看

    const { pathList, pathMap, nameMap } = createRouteMap(routes)

## createMatcher -> createRouteMap ##
这里看看`createRouteMap`做了什么。`createRouteMap`返回一个对象，这个对象有3个属性，如下:

    // createMap返回值
    {
      pathList: Array<string>;
      pathMap: Dictionary<RouteRecord>;
      nameMap: Dictionary<RouteRecord>;
    }
    // 3个集合的初始化
    const pathList: Array<string> = oldPathList || []
    const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null)
    const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null)
    
    pathList:一个装有path的数组
    pathMap:一个以path为键，record为值的对象
    nameMap:一个以name为键，record为值的对象

pathList是数组，pathMap和nameMap是对象。createRouteMap第一个参数接收一个routes对象，那么看看对routes做了什么。

      routes.forEach(route => {
    	addRouteRecord(pathList, pathMap, nameMap, route)
      })
遍历routes,然后调用addRouteRecord，前三个参数分别已经初始化为了数组和2个对象，最后一个参数为routes中某一条遍历的route，来看看addRouteRecord做了什么。
## createMatcher -> createRouteMap -> addRouteRecord##

    const { path, name } = route
拿到一条记录的path和name，通常情况下name一般不传，但是path肯定会有。拿到path和name。然后运行下面:

    const normalizedPath = normalizePath(path, parent)

## createMatcher ->createRouteMap -> addRouteRecord->normalizePath ##
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

      // 将每个route转化成一个record放入到pathMap,pathList,nameMap中
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
创建了一个record对象，这个对象有已经标准化的path属性，存在regex属性，components属性，如果没有components，那么就用component，然后instances初始化为一个对象，name就是name，parent就是parent，matchAs就是matchAs，redirect为route的redirect，beforeEnter钩子，meta属性，props属性如果是null那么就初始化为{}，如果`routes.components`存在就使用`route.props`,如果不存在，就用`route.props`。
##createMatcher -> createRouteMap->addRouteRecord->children ##

    if (route.children) {
	    route.children.forEach(child => {
	      const childMatchAs = matchAs
	    	? cleanPath(`${matchAs}/${child.path}`)
	    	: undefined
	      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
	    })
    }
    routes：[
      {
         path:'/user/:id',component:User,
         children:[
             {
              // 当 /user/:id/profile被匹配到的时候
              // 这里就会渲染，UserProfile在User组件里面的<router-view>中渲染
               path:"profile",
               component:UserProfile
             }
         ]
      }
    ]
当route存在children属性的时候，表示存在路由的嵌套的关系，继续递归地去调用addRouteRecord，但是这个时候，第五个和第六个参数可能会存在，因为既然是`children`，那么就需要基于父的路径，把父路径拼接到每一条子路径的前面。这里处理`children`属性，下面继续处理`alias`属性。
## createMatcher ->createRouteMap->addRouteRecord->alias ##
    
      if (route.alias !== undefined) {
	    const aliases = Array.isArray(route.alias)
	      ? route.alias
	      : [route.alias]
	    
	    aliases.forEach(alias => {
	      const aliasRoute = {
	    	path: alias,
	    	children: route.children
	      }
	      addRouteRecord(
	    	pathList,
	    	pathMap,
	    	nameMap,
	    	aliasRoute,
	    	parent,
	    	record.path || '/' // matchAs
	      )
	    })
      }

alias顾名思义就是别名的意思，它的使用方式如下：

    routes：[{
    	path:'/a',component:A,alias:'/b'
    }]
别名就是当用户访问`/a`的时候用组件`A`去适配，用户访问`/b`的时候，也是用组件`A`去是适配。官方给定的使用情况是，如果某个组件的嵌套匹配，相当复杂，那么可以考虑用别名来替换。处理alias属性的逻辑如上面所示，alias可以是一个字符串数组，也可以是单独的某个路径（通常情况下就是一个路径），如果是单独的路径也会转化成一个数组，然后遍历这个数组，新建一个跟route一模一样的`aliasRoute`,`path`为遍历的每一个路径,`children`共享`route`的`children`，因为alias就是别名，最后通过addRouteRecord来添加，注意这里的第六个参数`matchAs`，这里相当于使用的是record.path,相当于反过来说，`aliasRoute`的别名就是`record.path`
## createMatcher ->createRouteMap->addRouteRecord-> 收集不存在的path##
如果`pathMap`中没有当前`record.path`，那么把这个`record.path`压入到`pathList`,在`pathMap`中做一个映射，以路径为键，record为值。代码如下

     if (!pathMap[record.path]) {
	    // pathList存入这个path
	    // path为键,record为键
	    pathList.push(record.path)
	    pathMap[record.path] = record
      }

## createMatcher ->createRouteMap->addRouteRecord->name ##
如果route中存在name,并且`nameMap`中还没收集这个name，那么以name为键，record为值来收集。

    if (name) {
	    if (!nameMap[name]) {
	      nameMap[name] = record
	    }
    }
走到这里addRouteRecord执行完成，继续往下面走。
## createMatcher ->createRouteMap->addRouteRecord ##
遍历`pathList`,把以`*`作为path的路径压到pathList的后面。最后返回

      for (let i = 0, l = pathList.length; i < l; i++) {
    	if (pathList[i] === '*') {
      		pathList.push(pathList.splice(i, 1)[0])
      		l--
      		i--
    	}
      }
     
    return {
    	pathList,
    	pathMap,
    	nameMap
      }
运行到这里addRouteRecord运行完毕。
## createMatcher ##
在`createRouteMap`执行完成后，产生了3个结果集，它们分别是`pathList`,`pathMap`,`nameMap`,这3个结果集存在一个闭包中，通过后面定义的几个方法来操作这几个结果集。后面定义的函数有
## createMatcher->addRoutes ##

addRoutes接受一个routes这个参数，通过解析这个routes对象，将record放进`createWatcher`产生的闭包环境中`pathList`，`pathMap`，`nameMap`中。

      function addRoutes (routes) {
    	createRouteMap(routes, pathList, pathMap, nameMap)
      }

## createMatcher->match ##

## createMatcher->redirect ##
## createMatcher->_createRoute ##

## createMatcher ##
以上的函数定义完成后，返回一个matcher对象，如下

      return {
    	match,
    	addRoutes
     }
matcher存在2个方法，一个是match一个是addRoutes。到这里createMatcher完成。
## 总结 ##
