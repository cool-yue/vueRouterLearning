createMatcher是初始化VueRouter对象的其中的一个环节。同样Matcher也是比较复杂过程。下面来看看这个过程。

    function createMatcher (
      routes: Array<RouteConfig>,
      router: VueRouter
    ){}
    
    routes = [{path:"/foo",component:Foo}]
    router:this

createMatcher接受2个参数,第一个是routes对象,第二个是vueRouter对象。下面开始分析过程。

    const { pathList, pathMap, nameMap } = createRouteMap(routes)

## createMatcher -> createRouteMap ##
这里看看`createRouteMap`做了什么。`createRouteMap`返回一个对象，这个对象有3个属性，如下:

    // createRouteMap接受的参数
    function createRouteMap (
	  routes: Array<RouteConfig>,
	  oldPathList?: Array<string>,
	  oldPathMap?: Dictionary<RouteRecord>,
	  oldNameMap?: Dictionary<RouteRecord>
	){}

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

	function addRouteRecord (
	  pathList: Array<string>,
	  pathMap: Dictionary<RouteRecord>,
	  nameMap: Dictionary<RouteRecord>,
	  route: RouteConfig,
	  parent?: RouteRecord,
	  matchAs?: string
	) {}

`addRouteRecord`可以接受6个参数,但是初始调用没有传入6个参数，是因为有些参数是后面递归到深层才会使用的，比如`routes`中的每个`route`都需要转化为一个`routeRecord`，由于`vue`的路由可以根据深度来判断哪一层渲染哪个组件，因此树形结构，然后同时`vue`组件的渲染也是通过深度优先渲染原则，有深度优先，那么必然会有`parent`,因此这里的`parent`是针对递归生成子组件的record所需要的， 初始调用显然是路由的根开始，根是没有parent的，所有初始调用后面的参数比如parent没有传入。下面继续看`addRouteRecord`中的流程。

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
标准化的逻辑就是，如果path最后有`/`,那么就将其去掉，同时如果path第一个字符为`/`,那么就直接返回,因为表示这是从根路径开始,如果parent没有传表示没有parent,其余情况就是path的第一个字符不以`/`开头，同时又存在parent的话，那么运行到这里表示，parent.path和path需要组合成一个复合路径，也就是说存在children。`cleanPath`做了什么。就是把`//`换成一个`/`,整体来说还是标准化的过程。运行到这里标准化的path已经生成了,继续往下执行。

    const pathToRegexpOptions: PathToRegexpOptions = route.pathToRegexpOptions || {}
通常情况下`pathToRegexpOptions`并没有传,因此这里的细节先略过，继续往下执行。

    if (typeof route.caseSensitive === 'boolean') {
    	pathToRegexpOptions.sensitive = route.caseSensitive
      }
这里caseSensitive表示是否大小写敏感，通常来说这里也不会传，因此这里的细节先略过。继续往下执行，下面创建一个record,这里是整个`addRouteRecord`函数的核心，

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
创建了一个record对象，这个对象有已经标准化的path属性，也就是拼接了父节点的`path`，对于regex属性也就是正则这里先不考虑，components属性，如果没有components，那么就用component，这里注意无论是component还是components它们最终都会转化成components属性，components属性是一个对象，键值为`router-view`的`name`，不写name也就是只有一个`router-view`的时候，那么component转化的components就为`{default:component}`。然后instances初始化为一个空对象，name就是name，parent就是parent，matchAs就是matchAs，redirect为`route`的`redirect`，`beforeEnter`为`route`的`beforeEnter`，`meta`属性为`route`的`meta`如果不存在就设为null，props属性如果是null那么就初始化为{}，如果`routes.components`存在就使用`route.props`,如果不存在，因为component已经转化成了components属性，因此props也要转化成对应的模式，也就是route.props转化成`{default:route.props}`。运行到这里当前的`route`的最外层已经转化成了的`routeRecord`，以下就需要判断有没有`children`,如果有那么就会递归下去执行`addRouteRecord`,使得每一条`children`都以相同的规则生成`routeRecord`，注意到运行到这里，实际上`父record`已经生成完毕了，所以在生成`route.children`中的`子record`的时候，这时候`addRouteRecord`的第五，第六个参数就会被传入，这样对于`子record`的添加，它们就存在`parent`，最终它们都会被放入到`pathList`,`pathMap`,`nameMap`这几个集合中，这样也就是说，虽然是以树形的结构去定义了`routes`，但最终生成的`record`都是独立的一条，但它们之间通过`parent`来进行联系，同时`path`或者`name`作为键，能够很好地实现字段，加快查找速度。
##createMatcher -> createRouteMap->addRouteRecord->children ##
    
    // 如果检测到有children属性把children的属性也生成record
    // 处理children的时候由于parentRecord已经生成,因此parent已经存在
    // 同时看parentRecord有没有matchAs也就是别名,有的话把matchAs作为父路径 
    // 同理那么子record的matchAs就是父亲的matchAs/child.path
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

       // 这里也没值
	  // 如果存在alias,有alias也就是别名，无非就是用别名作为path再来添加一次record
	  // 这里要注意的是最后一个参数用的是当前record.path,
	  // aliasRoute中只存在{path:alias 和 children}
	  // 所以alias生成的record并没有components,因为没传入component或者components
	  // 但是alias生成的record存在matchAs这个字段，这个字段就是Record.path这个字段
	  // 至于children,由于父路由组件由别名,因此在这个父组件下面的子组件也需要可以匹配这个别名
	  // 最终继续将它们全部放入pathList,pathMap,nameMap集合中
    
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
## createMatcher ->createRouteMap->addRouteRecord-> record放入定义的几个集合中##
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
在`createRouteMap`执行完成后，产生了3个结果集，它们分别是`pathList`,`pathMap`,`nameMap`,这3个结果集存在一个闭包中，通过后面定义的几个方法来操作这几个结果集。运行到这里createMatcher的逻辑已经走完了，后面的逻辑只是定义函数，形成一个闭包，然后返回`{match,addRoutes}`,可以看到`match`方法和`addRoutes`方法相当重要。
## createMatcher->addRoutes ##

addRoutes接受一个routes这个参数，通过解析这个routes对象，将record放进`createWatcher`产生的闭包环境中`pathList`，`pathMap`，`nameMap`中。

      function addRoutes (routes) {
    	createRouteMap(routes, pathList, pathMap, nameMap)
      }
`addRoutes`方法顾名思义就是将`routes`这样的对象解析生成`routeRecord`,然后放入到`pathList`,`pathMap`,`nameMap`这3个集合中。

## createMatcher->match ##
	  function match (
	    raw: RawLocation,
	    currentRoute?: Route,
	    redirectedFrom?: Location
	  ）{}
match方法接受3个参数，第一个参数为`rawLocation`，这个`rawlocation`就是一个字符串的路径对于hash模式，这个路径就是#号后面的东西。第二个参数为currentRoute为一个Route对象，第三个参数为Location对象，可以不传。

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
