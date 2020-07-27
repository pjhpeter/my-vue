# Vue源码学习(2)——Vue侦听器watch实现原理

## 前言

看这篇文章之前最好先对Vue的MVVM实现原理有一定的认识，因为这是Vue的核心概念，其他的工具大部分都是在此之上锦上添花，如果你不是很了解，可以先看看这篇文章：

[Vue的MVVM原理](https://blog.csdn.net/tq26556570/article/details/107579098)

## 实现原理分析

### initState

在Vue源码的**src/core/instance/state.js**中，我们可以看到有个**initState**方法，里面有一个**initWatch**方法的调用，在这个初始化watch的方法中我们就可以看到watch的实现原理。

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
  // 对navtiveWatch的处理是由于Firefox浏览器的Object自身就拥有watch方法
  // 所以这里是作一个浏览器兼容处理
  if (opts.watch && opts.watch !== nativeWatch) {
    // 初始化watch
    initWatch(vm, opts.watch)
  }
}
```

### initWatch

看看initWatch方法做了什么：

```js
function initWatch (vm: Component, watch: Object) {
  // 遍历vm.watch的每一个key
  for (const key in watch) {
    const handler = watch[key]
    // Vue运行一个key有多个侦听器处理，所以允许传入一个数组，详见Vue官方文档的API
    // https://cn.vuejs.org/v2/api/#watch
    // 一旦key的值发生改变，数组中的多个侦听器处理方法会依次执行
    // 比如这样的写法：
    /*
    new Vue({
      // .......其他参数
      watch: {
        name: [
          function handler1(newValue, oldValue){
            // 具体实现
          },
          function handler2(newValue, oldValue){
            // 具体实现
          },
          ......
        ]
      }
    });
    */
    if (Array.isArray(handler)) {
      // 如果当前处理方法是一个数组
      // 遍历这个数组，给key添加所有侦听器处理方法
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      // 如果不是数组
      // 直接添加当前处理方法
      createWatcher(vm, key, handler)
    }
  }
}
```

### createWatcher

再看看**createWatcher**的实现：

```js
function createWatcher (
  vm: Component,
  // key
  expOrFn: string | Function,
  // 侦听处理方法
  handler: any,
  // 一些配置项
  // deep、immediate等
  options?: Object
) {
  if (isPlainObject(handler)) {
    // 如果handler是一个对象
    // 就是类似这种写法：
    /*
    new Vue({
      // .......其他参数
      watch: {
        name: {
          handler: function(newValue, oldValue) {},
          deep: true,
          immediate: true
        }
      }
    });
    */
    // 保存配置项
    options = handler
    // handler.handler才是真正的处理方法
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    // 如果handler是一个字符串
    // 就是类似这种写法：
    /*
    new Vue({
      // .......其他参数
      watch: {
        name: “handler1”
    });
    */
    // 就会到vm的methods中寻找这个名字的方法作为handler
    handler = vm[handler]
  }
  // vm.$watch才是真正创建侦听器的方法
  return vm.$watch(expOrFn, handler, options)
}
```

### vm.$watch

```js
Vue.prototype.$watch = function (
  // key
  expOrFn: string | Function,
  // handler
  cb: any,
  // 一些参数配置
  // deep、immediate等
  options?: Object
): Function {
  const vm: Component = this
  if (isPlainObject(cb)) {
    // 如果handler是一个对象
    // 递归调用createWatcher方法解析，得到真正的handler
    return createWatcher(vm, expOrFn, cb, options)
  }
  options = options || {}
  // Vue的watcher分成了computed-watcher、user-watcher、render-watcher三个类型
  // computed-watcher是解析用户定义的计算属性computed时会产生的watcher
  // 模板编译时，给属性添加的watcher会自动绑定一个视图响应式更新的方法，就是render-watcher
  // 而这里的watcher是用户自定义的侦听器，所以定义为user-watcher
  options.user = true
  // 侦听器实际上就是实例化的一个订阅者Watcher
  // 只不过回调函数时用户自定义的handler
  const watcher = new Watcher(vm, expOrFn, cb, options)
  if (options.immediate) {
    // 如果设置了immediate: true
    // 会立即执行一次handler
    try {
      cb.call(vm, watcher.value)
    } catch (error) {
      handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
    }
  }
  
  // 我们看到vm.$watch方法会返回一个函数
  // 这个函数的作用就是解除当前侦听器的绑定
  // 我们使用this.$watch方法去定义侦听器的时候可以接收到这个返回的方法
  // 想要解除绑定的时候调用它就行
  // 像这样：
  /*
  
  // 创建侦听器
  const unwatch = this.$watch("user.name", function(){}, {deep: true});
  
  // 解除侦听器绑定
  unwatch();
  
  */
  return function unwatchFn () {
    watcher.teardown()
  }
}
```

### 实现侦听

从前面的代码可以看出，侦听器watch的功能，侦听属性变化，触发处理方法handler的实现，还是通过实例化一个订阅者Watcher，从而回到了Vue的MVVM响应式机制当中。在源码的src/core/observer/watch.js中，Watcher类里面有对于侦听器的一些处理，我们一起看一下。

```js
export default class Watcher {
  vm: Component;
  expression: string;
  // handler
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
    // key
    expOrFn: string | Function,
    // handler
    cb: Function,
    // 各种配置项
    // // deep、immediate等
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this
    }
    // 添加到_watchers数组中
    // 这个数组在initState方法中被定义
    vm._watchers.push(this)
    
    // 读取配置项的值
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    
    // 各种变量的赋值
    this.cb = cb
    this.id = ++uid
    // 将当前watcher设置为激活状态
    this.active = true
    // 延迟取值，computed中会用到
    this.dirty = this.lazy
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // 将传入的key解析成可以取值的方法
    // 比如传入的key是person.name
    // 那就会解析成可以return vm.$data.person.name的取值方法
    if (typeof expOrFn === 'function') {
      // 如果key本身就是一个方法，说明不用解析，直接给getter赋值
      // 这里也看得出其实调用this.$watch方法创建侦听器时
      // 可以给key传入一个返回想侦听的变量值的方法
      // 而且这样写代码循行效率会高一些
      this.getter = expOrFn
    } else {
      // 如果传入的是一个字符串
      // 那就将字符串解析成一个返回想侦听的变量值的方法并赋值给getter
      // parsePath在src/core/util/lang.js中定义
      // 比如key是person.name，parsePath方法会返回一个就会循环一层一层取值的函数
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 读取当前data中对应属性的值作为原始值
    // 作用时当data对应属性的值发生改变时
    // 可以判断原始值和新的值是否不一样
    // 不一样的时候才去更新视图，提高效率
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    // 这里就是前面Vue的MVVM原理的文章中提到的给Dep.target赋值的地方
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 执行getter方法取值
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // 如果设置了deep: true
      // 这里会作处理
      if (this.deep) {
        // traverse方法在src/core/observer/traverse.js中实现
        // 主要功能是递归每一层取值，触发getter方法，添加watcher
        // 此时Dept.target还是指向当前watcher
        // 所以每一层的属性都会于当前watcher关联
        traverse(value)
      }
      // 这里就是类似Dep.target = null的实现
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  // ......忽略一些方法

  // 侦听的值被改变的时候会触发update方法
  update () {
    // 这里是针对延迟取值的操作
    // computed的实现会用到
    // 这里先不讲
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      // 以前版本的官方文档中
      // Watcher是可以通过配置sync参数来同步执行handler
      // 但是现在的官方文档中对应的说明已经没有了
      // 不过代码的处理还保留着，那就是还是可以用的^_^
      this.run()
    } else {
      // 如果不是同步执行handler
      // 就会把当前watcher放入队列中
      // 通过nextTick的机制来异步执行run方法
      // 可以看看源代码的实现，这里就不深入讲了
      queueWatcher(this)
    }
  }

  // 执行handler方法
  run () {
    // 判断是否是激活的watcher
    if (this.active) {
      // 获取当前的新值
      const value = this.get()
      // 符合以下条件才会去调用handler
      if (
        // 新值不等于原值
        value !== this.value ||
        // value是一个对象或数组时，即使value和this.value相等，也会触发handler
        // 因为对象或数组内部的值可能会改变
        isObject(value) ||
        // 深度侦听的属性，内部的值也可能会改变，一样直接触发handler
        this.deep
      ) {
        // 缓存原值
        const oldValue = this.value
        // 将新值设置为原值
        this.value = value
        // 判断是否user-watcher
        if (this.user) {
          // 前面讲过，侦听器全部都是user-watcher
          // 所以侦听器会进入这个代码块中
          try {
            // 执行用户自定义的侦听处理方法handler
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  // ......忽略一些方法
}
```

看看traverse方法做了什么：

```js
// 设置的deep: true就会进入这个方法处理
export function traverse (val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}

function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)
  // 如果val不是数组，不是对象，或者被冻结，或者是一个虚拟节点对象
  // 直接return，不在往下执行
  // 那就是说deep只会对数组和普通对象起作用
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  
  // 在数据劫持的时候Vue会给属性值添加一个__ob__属性
  // 这个值指向一个Observer的实例
  if (val.__ob__) {
    // 进来这段代码说明val已经经过数据劫持
    // 获取val对应的依赖收集器Dep的id
    const depId = val.__ob__.dep.id
    // 先判断dep.id是否已经存在于集合中
    if (seen.has(depId)) {
      return
    }
    // 将属性对应的依赖收集器Dep的id存入一个集合里面
    seen.add(depId)
  }
  if (isA) {
    // 如果val是数组
    i = val.length
    // 循环遍历每个数组元素，递归执行_traverse方法解析
    // 当使用val[i]取值的时候
    // 实际上已经调用了val对应数组元素的getter方法
    // 把Watcher添加到该数组元素的依赖收集器中
    while (i--) _traverse(val[i], seen)
  } else {
    // 如果val是对象
    keys = Object.keys(val)
    i = keys.length
    // 遍历每个key的值，递归执行_traverse方法解析
    // 当使用val[keys[i]]取值的时候
    // 实际上已经调用了val对应属性的getter方法
    // 把Watcher添加到该属性的依赖收集器中
    while (i--) _traverse(val[keys[i]], seen)
  }
}
```

## 总结

整体的流程如下：

![在这里插入图片描述](https://img-blog.csdnimg.cn/20200727163424939.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3RxMjY1NTY1NzA=,size_16,color_FFFFFF,t_70)

侦听器watch的实现原理还算比较简单的，主要是在响应式原理的基础上添加了一些变化，如果理解了Vue的MVVM响应式原理，侦听器的实现就很好理解了。

完结撒花，谢谢大家^_^