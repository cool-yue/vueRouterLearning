import Vue = require("vue");
import { ComponentOptions, PluginFunction } from "vue";

type Component = ComponentOptions<Vue> | typeof Vue;
type Dictionary<T> = { [key: string]: T };

export type RouterMode = "hash" | "history" | "abstract";
export type RawLocation = string | Location;
export type RedirectOption = RawLocation | ((to: Route) => RawLocation);
export type NavigationGuard = (
  to: Route,
  from: Route,
  next: (to?: RawLocation | false | ((vm: Vue) => any) | void) => void
) => any

declare class VueRouter {
  constructor (options?: RouterOptions);

  app: Vue;
  mode: RouterMode;
  currentRoute: Route;

  beforeEach (guard: NavigationGuard): Function;
  beforeResolve (guard: NavigationGuard): Function;
  afterEach (hook: (to: Route, from: Route) => any): Function;
  push (location: RawLocation, onComplete?: Function, onAbort?: Function): void;
  replace (location: RawLocation, onComplete?: Function, onAbort?: Function): void;
  go (n: number): void;
  back (): void;
  forward (): void;
  getMatchedComponents (to?: RawLocation | Route): Component[];
  onReady (cb: Function, errorCb?: Function): void;
  onError (cb: Function): void;
  addRoutes (routes: RouteConfig[]): void;
  resolve (to: RawLocation, current?: Route, append?: boolean): {
    location: Location;
    route: Route;
    href: string;
    // backwards compat
    normalizedTo: Location;
    resolved: Route;
  };

  static install: PluginFunction<never>;
}

type Position = { x: number, y: number };

// 传入VueRouter构造函数的选项
// 通常情况下只用到了routes
// 它还能传入下面这些属性
export interface RouterOptions {
  routes?: RouteConfig[];
  mode?: RouterMode;
  fallback?: boolean;
  base?: string;
  linkActiveClass?: string;
  linkExactActiveClass?: string;
  parseQuery?: (query: string) => Object;
  stringifyQuery?: (query: Object) => string;
  scrollBehavior?: (
    to: Route,
    from: Route,
    savedPosition: Position | void
  ) => Position | { selector: string, offset?: Position } | void;
}

type RoutePropsFunction = (route: Route) => Object;

// 正则规则
export interface PathToRegexpOptions {
  sensitive?: boolean;
  strict?: boolean;
  end?: boolean;
}

// RouteConfig这个相当于用户前期配置的RouteConfig数组称为routes
export interface RouteConfig {
  path: string;
  name?: string;
  component?: Component;
  components?: Dictionary<Component>;
  redirect?: RedirectOption;
  alias?: string | string[];
  children?: RouteConfig[];
  meta?: any;
  beforeEnter?: NavigationGuard;
  props?: boolean | Object | RoutePropsFunction;
  caseSensitive?: boolean;
  pathToRegexpOptions?: PathToRegexpOptions;
}

// 一条route可以转化成一条routeRecord
// 可以这么来形容route和routeRecord的关系
// route本质上是为了匹配某个路由然后到指定的组件
// 但是route的原生定义通常只有组件的options和path
// 并没有真正的components和instance
// 相当于Record把其path对应的组件进行了组件化
export interface RouteRecord {
  // path同route的path
  path: string;
  // 正则
  regex: RegExp;
  // 组件字典
  components: Dictionary<Component>;
  // 组件实例字典
  instances: Dictionary<Vue>;
  // 路由name
  name?: string;
  // 路由的parentRecord
  parent?: RouteRecord;
  // 重定向的选项
  redirect?: RedirectOption;
  // 别名
  matchAs?: string;
  // 元数据
  meta: any;
  // beforeEnter的钩子
  beforeEnter?: (
    route: Route,
    redirect: (location: RawLocation) => void,
    next: () => void
  ) => any;
  props: boolean | Object | RoutePropsFunction | Dictionary<boolean | Object | RoutePropsFunction>;
}

export interface Location {
  // 这个就是route的name
  name?: string;
  // 同route的path
  path?: string;
  // 同route的hash
  hash?: string;
  // 同route的query
  query?: Dictionary<string>;
  // 同route的params
  params?: Dictionary<string>;
  // 标志位,标志是否会基于某个path来进行路径的插入
  // 如果没设置这个,就是从/a到/b
  // 设置了之后就是/a到/a/b
  append?: boolean;
  // 如果设置了replace就是替换就是调用router.push
  replace?: boolean;
}

export interface Route {
  // 一个为当前路由的字符串，总是将这个处理成为绝对路径
  path: string;
  // 这个name字段为选择性的，如果有，它就是当前路由的name
  name?: string;
  // 当前路由的hash,注意是包含了#的hash
  hash: string;
  // 一个包含了键值对的queryString比如/foo?user=1,我们拿到的是$route.query.user == 1,如果没有query，这里将会是一个空对象
  query: Dictionary<string>;
  // 一个包含了键值对的对象，表示的是动态片段和星花片段，如果没有参数就是个空对象
  params: Dictionary<string>;
  // 完全处理后的path，包括了query和hash
  fullPath: string;
  // matched字段相当于内部生成的便于操作的一个数组
  matched: RouteRecord[];
  // 重定向路由的名字
  redirectedFrom?: string;
  // meta元数据
  meta?: any;
}
