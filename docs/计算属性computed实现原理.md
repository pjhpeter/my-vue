# 计算属性computed实现原理

## 前言

看这篇文章之前最好先对Vue的MVVM实现原理有一定的认识，因为这是Vue的核心概念，其他的工具大部分都是在此之上锦上添花，如果你不是很了解，可以先看看这篇文章：

[Vue的MVVM原理](https://blog.csdn.net/tq26556570/article/details/107579098)

## 实现原理分析

### initState

在Vue源码的**src/core/instance/state.js**中，我们可以看到有个**initState**方法，里面有一个**initComputed**方法的调用，在这个初始化computed的方法中我们就可以看到计算属性的实现原理。

```js
// 这个方法在src/core/instance/index.js中会被调用
// 用于初始化props、methods、computed和watch
// 以及实现data的数据劫持
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  // 初始化props
  if (opts.props) initProps(vm, opts.props)
  // 初始化methods
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    // 数据劫持入口
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  // 初始化computed
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    // 初始化watch
    initWatch(vm, opts.watch)
  }
}
```

### initComputed

```js
// 定义计算属性需要的配置项
const computedWatcherOptions = { lazy: true }

function initComputed (vm: Component, computed: Object) {
  // 初始化时，vm._computedWatchers是undefined，将它初始化为空对象{}
  const watchers = vm._computedWatchers = Object.create(null)
  // 是否服务端渲染
  const isSSR = isServerRendering()
  // 遍历用户定义的computed的所有属性
  for (const key in computed) {
    const userDef = computed[key]
    // 获取用户定义computed的getter方法
    // 可能会直接赋值一个函数，后者会赋值一个对象
    // 就像这样：
    /*
    new Vue({
      // ......忽略其他属性
      computed: {
       // 赋值函数，函数就作为getter方法
       computeAge: function() {}
       // 赋值对象
       computeName: {
         set: functon(value) {},
         get: function() {}
       }
      }
    });
    */
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    // 如果不是服务端渲染，才会实例化订阅者
    if (!isSSR) {
      // 实例化订阅者Watcher，并以key作为属性名添加到vm._computedWatchers对象中
      // 这里可以看出计算属性的实现还是基于MVVM的响应式原理的扩展
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        // 这里设置了{ lazy: true }，延迟获取值
        // 就是Watcher在实例化的时候不会调用get方法读取当前值
        computedWatcherOptions
      )
    }

    // 判断computed的key是否已经在data或者props中存在
    // 如果key与data或props中的属性重名，会发出警告
    // 且不会再定义计算属性
    if (!(key in vm)) {
      // 定义计算属性
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}
```

### defineComputed

```js
export function defineComputed (
  // vm
  target: any,
  // 计算属性的名称
  key: string,
  // 用户定义的计算属性的值
  // 可能是一个函数或者对象
  userDef: Object | Function
) {
  // 只有非服务端渲染的时候
  // computed才会缓存属性值，只有属性值发生改变才去调用getter
  // 那就是说如果是服务端渲染，每次调用computed属性，都会调用getter
  // 下面有具体的实现
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    // 用户定义计算属性的值是一个函数
    sharedPropertyDefinition.get = shouldCache
      // 非服务端渲染的情况
      ? createComputedGetter(key)
      // 服务端渲染的情况
      : createGetterInvoker(userDef)
    // userDef会作为getter使用
    // setter就什么都不做
    sharedPropertyDefinition.set = noop
  } else {
    // 如果用户定义计算属性是一个对象
    // 会把get属性的值赋值给getter
    sharedPropertyDefinition.get = userDef.get
      // userDef.cache配置了计算属性是否可以缓存
      // 说明即使是浏览器渲染，只要我们配置了cache: false
      // 计算属性也不会缓存值
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    // 把set属性赋值给setter
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  // 将计算属性的名称和定义好的getter和setter绑定在一起
  // 并且将计算属性作为普通属性绑定到vm中
  // 这样计算属性就会生效了
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
```

下面我们在来看createComputedGetter和createGetterInvoker具体做了什么：

createComputedGetter方法：

```js
// 创建计算属性的getter
// 这样定义一个函数，先出入参数，返回另一个函数
// 在其他时机调用这个返回的函数来处理之前传入的一些参数的写法
// 叫函数柯里化，不明白自行百度
function createComputedGetter (key) {
  return function computedGetter () {
    // 取出当前计算属性的watcher
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      // 如果计算属性的值发生过改变，重新计算值
      if (watcher.dirty) {
        // 当计算属性第一次被读取的时候就会调用watcher的get方法计算值
        // 此时等同于读取了计算属性访问的所有响应式属性的值
        // 触发所有访问的响应式属性的getter方法
        // 此时Dep.target指向的就是当前的watcher
        // 所以所有访问的响应式属性的依赖收集器都会加上与当前watcher的依赖
        // 任何一个访问的响应式属性的值发生变化都会触发当前watcher的update方法
        // 把dirty赋值为true
        watcher.evaluate()
        // 这个方法之后Dep.target会变回render-watcher
      }
      
      // 这里是页面渲染时触发的getter方法
      // 所以Dep.target为render-watcher
      if (Dep.target) {
        // 将render-watcher添加到依赖收集器Dep中
        watcher.depend()
      }
      // 返回缓存的值或者重新计算的值
      return watcher.value
    }
  }
}
```

Watcher.evaluate方法：

```js
evaluate () {
  // 就是重新取值
  this.value = this.get()
  this.dirty = false
}
```

createGetterInvoker方法：

```js
// 如果是服务端渲染，就会使用这个方法处理
// 只是单纯地执行了传入的方法
function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}
```

### Watcher对计算属性的处理

前面提到了，计算属性是基于Vue的MVVM响应式原理扩展的，还是数据劫持配合发布者-订阅者模式实现，前面的代码已经实现了对计算属性的数据劫持，下面我们来看看怎么通知计算属性改变的，在src/core/observer/watcher.js中有对应处理。

```js
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    // getter
    expOrFn: string | Function,
    // noop，什么都不做
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this
    }
    vm._watchers.push(this)
    // 读取各种配置
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid
    this.active = true
    // 这里将lazy的值赋值给了dirty
    // 就是说实例化的时候dirty = lazy = true
    this.dirty = this.lazy
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''

    if (typeof expOrFn === 'function') {
      // 传进来的expOrFn就是getter方法
      // 所以会直接进来这个代码块，给watcher.getter赋值
      this.getter = expOrFn
    } else {
      // 不会进这里
      // ......省略相关代码
    }
    
    // 当lazy = true时，不会马上调用get方法读取当前值
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  // 读取订阅者对应属性当前的值
  get () {
    // 类似于Dep.target = this
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 调用getter取值
      // 这里会触发属性的getter方法
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // 处理watch的，这里不关心这个
      if (this.deep) {
        traverse(value)
      }
      // 类似于Dep.target = null
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  // ......省略一些方法

  // 当调用了属性的setter方法后，会触发update方法调用
  update () {
    if (this.lazy) {
      // 计算属性会进来这段代码块
      // 这里将dirty赋值为true
      // 也不会马上去读取值
      // 当render-watcher的update被触发时
      // 重新渲染页面，计算属性会重新读值
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }

  // 当读取计算属性的值时，getter中会判断dirty是否为true
  // 如果为true，就会进入这个方法重新取值
  evaluate () {
    // 调用get方法取值时，其实就会条用计算属性
    this.value = this.get()
    this.dirty = false
  }

  // ......省略一些方法

}
```

## 总结

computed的逻辑比watch的要复杂一些，没那么好理解，尤其是在将访问到的响应式属性的值被改变之后，调用了computed-watcher的update方法，只是将dirty赋值为true，什么时候调用computed的getter方法去重新计算，我到了很久断点才发现原来是在render-watcher的update方法被调用，重新渲染视图的时候会调用到computed的getter方法，所以为了方便理解我把整个流程画出来。

![在这里插入图片描述](https://img-blog.csdnimg.cn/20200728190517901.png)

完结撒花，谢谢大家^_^

