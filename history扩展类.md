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
针对以上的几个重写的方法，下面来分析`HashHistory`，初始化创建vueRouter在`new`一个`HashHistory`的时候，
## HTML5History ##
## AbstractHistory ##


contract-id : 1
type: "contract-1"   "invoice-1"  "waiwei-1"

row :   1   发票 

row ：  1  发票附件  2 发票附件  3发票附件
