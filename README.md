# Vue的MVVM原理

> 虽然很多人写过这样的文章了，但是看别人的一百遍还不如自己写一遍，整理好写出来就是自己的了，不会忘记。所以还是自己写一次吧，哈哈！

## 什么是MVVM

MVVM是Model-View-ViewModel的简写。它本质上就是MVC 的改进版。MVVM 就是将其中的View 的状态和行为抽象化，让我们将视图 UI 和业务逻辑分开。（来自百度的解释^_^）

其实就是通过ViewModel的处理，将View和Model的解耦，不需要自己根据Model的数据变化去操作View的DOM，达到的效果就是我们可以专注写业务逻辑，把数据丢给ViewModel，我们可以专注地写页面，把页面绑定ViewModel，所有的DOM操作都由ViewModel来实现，我们不用关心，我们所看到的效果就是View会根据Model的变化而响应式变化。

目前主流的前端框架都已经实现的MVVM的模式的，比如React、AngularJS、Vue等，当然他们的实现原理各不相同。下面我们来看看Vue是怎么实现MVVM的吧。

## Vue的MVVM实现流程

![输入图片说明](https://images.gitee.com/uploads/images/2020/0724/151411_b71f0059_5449551.png "屏幕截图.png")

大概解释一下，Vue的MVVM实现是通过数据劫持配合发布者-订阅者模式完成的。首先是**new Vue**实例化一个Vue对象作为入口，new Vue的时候会创建**Observer**对象和**Compile**对象。

**Observer**负责数据劫持，观察数据变化，创建依赖收集器Dep对象。当数据发生变化的时候，通知Dep，然后Dep会通知所有相关的订阅者Watcher调用更新视图的回调函数，更新视图。

**Compile**负责解析指令和双大括号的插值表达式，将对应的数据渲染到页面相应的地方，同时创建订阅者**Watcher**，并添加到依赖收集器Dep中，绑定数据变化时，更新视图的回调函数。

以上流程的对应实现都可以在Vue源码中的**src/core/observer**目录中找到。

由于源码处理了很多细节的情况，我们思路不清晰的话看起来还是挺费劲的，现在跟大家一起尝试一下去简单实现一次MVVM，然后再看源代码或许会清晰很多。

## 手写MVVM

### 先写个页面

先创建一个my-vue文件夹吧，把正版的vue.js复制进去，然后在里面建一个index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vue源码学习</title>
</head>
<body>
    <div id="app">
        <h2>{{person.name}}--{{person.age}}</h2>
        <h3>{{person.interests}}</h3>
        <ul>
            <il>1</il>
            <il>2</il>
            <il>3</il>
            <il>4</il>
        </ul>
        <h3>{{memo.title}}</h3>
        <div v-text="memo.content"></div>
        <input type="text" v-model="memo.title">
        <input type="text" v-model="memo.content">
        <div v-html="htmlStr"></div>
        <button v-on:click="submitClick">提交</button>
        <button @click="cancleClick">取消</button>
    </div>
</body>
<script src="./vue.js"></script>
<script>
    const vm = new Vue({
        el: "#app",
        data: {
            person: {
                name: "张三",
                age: 18,
                interests: ["写代码", "踢球", "打游戏"]
            },
            memo: {
                title: "标题",
                content: "哈哈哈哈哈哈哈"
            },
            htmlStr: "<button>点我</button>"
        },
        methods: {
            submitClick: function(event) {
                console.log(this);
                console.log("提交按钮点击", event);
            },
            cancleClick: function(event) {
                console.log(this);
                console.log("取消按钮点击");
            }
        },
    });
</script>
</html>
```

用浏览器访问一下这个html，我们看到MVVM的数据双向绑定已经生效了的，当然这个跟我们没有关系，是尤雨溪做的。

### 入口函数

现在在my-vue文件夹中创建MyVue.js

```js
/**
 * Vue入口
 * @param options 配置参数
 */
function MyVue(options) {
    this.$el = options.el;
    this.$data = options.data;
    this.$options = options;

    if (!this.$el) throw new Error("el是必须传入的");

    // 1.实现观察者
    // 2.实现模板编译器
}
```

先写一个简单MyVue构造函数，接收一些配置项，看到最后有两行注释，我们需要在这里实例化Oberser和Compile，但是现在还没有实现这两个东西。

### Complie

直接在MyVue.js里面写吧。

```js
/**
 * 模板编译器
 * @param el 根节点 
 * @param vm Vue实例
 */
function Compile(el, vm) {
    // 判断el是DOM对象还是CSS选择器字符串
    this.el = this.isElementNode(el) ? el : document.querySelector(el);
    this.vm = vm;
    // 1.创建文档碎片，减少页面的回流和重绘
    // 2.编译模板
    // 3.将编译好的节点对象重新放回根节点中
}

/**
 * 判断传入的节点是否元素节点
 * @param node 节点对象
 * @returns 是否元素节点 
 */
Compile.prototype.isElementNode = function (node) {
    // 元素节点的nodeType为1
    return node.nodeType === 1;
}
```

这个模板编译器需要做的就是把我们HTML标签中的v-text、v-model、v-html和{{xxxxx}}这些指令和插值表达式替换成**data**中对应的值，这里会涉及到很多的DOM操作，如果我们每个操作都直接用**document.contentText**或者**document.innerHTML**这种API去操作的话，虽然可以实现效果，但是每次调用都会重绘整个页面，效率会非常低。因此我们使用文档碎片中进行DOM操作，然后再写到HTML中，我们可以通过**document.createDocumentFragment()**来创建文档碎片对象。

我们分成3步实现：
1. 创建文档碎片，减少页面的回流和重绘
2. 编译模板
3. 将编译好的节点对象重新放回根节点中

> 文档碎片可以理解成是DOM节点的缓存区域，文档碎片具备document一样的API，但是在文档碎片中操作DOM不会重绘页面，只有调用document.append(文档碎片)的时候，才会重绘页面，算上将原本的页面上的DOM节点转换成文档碎片操作，这个过程只引起了两次页面重绘，大大提升效率。

所以第一步我们要将el中的节点全部转换成文档碎片。

```js
/**
 * 模板编译器
 * @param el 根节点 
 * @param vm Vue实例
 */
function Compile(el, vm) {
    // 判断el是DOM对象还是CSS选择器字符串
    this.el = this.isElementNode(el) ? el : document.querySelector(el);
    this.vm = vm;
    // 1.创建文档碎片，减少页面的回流和重绘
    var documentFragment = this.nodeToDocumentFragment(this.el);
    // 2.编译模板
    // 3.将编译好的节点对象重新放回根节点中
}

/**
 * 将节点转换成文档碎片对象
 * @param node 节点对象
 * @returns 文档碎片对象
 */
Compile.prototype.nodeToDocumentFragment = function (node) {
    // 创建文档碎片对象
    var documentFragment = document.createDocumentFragment();
    // 遍历根节点的所有子节点
    var firstChild;
    while (firstChild = node.firstChild) {
        // 将子节点放入文档碎片对象中
        // 放入文档碎片后，页面上原有的节点会消失
        // 所以只有不断获取页面的第一个节点即可
        documentFragment.appendChild(firstChild);
    }
    return documentFragment;
}
```

然后我们就要编译模板了，这是一个比较复杂的过程，先看看代码。

```js
/**
 * 模板编译器
 * @param el 根节点 
 * @param vm Vue实例
 */
function Compile(el, vm) {
    // 判断el是DOM对象还是CSS选择器字符串
    this.el = this.isElementNode(el) ? el : document.querySelector(el);
    this.vm = vm;
    // 1.创建文档碎片，减少页面的回流和重绘
    var documentFragment = this.nodeToDocumentFragment(this.el);
    // 2.编译模板
    this.compile(documentFragment);
    // 3.将编译好的节点对象重新放回根节点中
}

/**
 * 编译文档碎片对象，解析指令和数据填充
 * @param documentFragment 文档碎片对象
 * 
 * <h2>{{person.name}}--{{person.age}}</h2>
        <h3>{{person.interests}}</h3>
        <ul>
            <il>1</il>
            <il>2</il>
            <il>3</il>
            <il>4</il>
        </ul>
        <h3>{{message}}</h3>
        <div v-text="message"></div>
        <div v-html="htmlStr"></div>
        <input type="text" v-model="message">
 */
Compile.prototype.compile = function (documentFragment) {
    const childNodes = documentFragment.childNodes;
    childNodes.forEach(node => {
        // 节点类型分成元素节点和文本节点，需要分别处理
        if (this.isElementNode(node)) {
            // 元素节点
            this.compileElement(node);
            
            // 递归遍历所有子节点
            if (node.childNodes && node.childNodes.length) {
                this.compile(node);
            }
        } else {
            // 文本节点
            this.compileText(node);
        }
    });
}
```

DOM节点分为文本节点和元素节点两类，文本节点就是纯文字，元素节点就是HTML标签，我们需要分别处理，比如文本节点我们要处理{{xxxxxx}}这种插值表达式，元素节点我们要处理v-text、v-model、v-html、v-on这种指令。元素节点还有可能会存在子节点，所以还要递归遍历。

那么我们先来看看元素节点怎么解析吧。

```js
/**
 * 编译元素节点
 * @param documentFragment 
 */
Compile.prototype.compileElement = function (documentFragment) {
    var attributes = documentFragment.attributes;
    // 遍历元素节点所有属性
    for (var index = 0; index < attributes.length; index++) {
        var attribute = attributes[index];
        var attributeName = attribute.nodeName;
        var attributeValue = attribute.nodeValue;
        // 判断是否指令
        if (this.isDirective(attributeName)) {
            // v-text、v-html、v-model、v-on:click
            // 将指令截取成：text、html、model、on:click
            var directive = attributeName.split("-")[1];
            // 截取事件
            var diretiveArr = directive.split(":");
            // text、html、model、on
            var directiveName = diretiveArr[0];
            // click
            var eventName = diretiveArr[1];
            // 根据指令调用相应方法
            CompileUtils[directiveName](this.vm, documentFragment, attributeValue, eventName);
            // 删除元素中的指令属性
            documentFragment.removeAttribute(attributeName);
        } else if (this.isEventName(attributeName)) {
            // 如果是事件绑定简写情况，@click
            var eventName = attributeName.split("@")[1];
            // 绑定事件
            CompileUtils.on(this.vm, documentFragment, attributeValue, eventName);
            // 删除元素中的指令属性
            documentFragment.removeAttribute(attributeName);
        }
    }
}

/**
 * 判断是否指令
 * @param attributeName 元素属性名称
 * @returns 是否指令
 */
Compile.prototype.isDirective = function (attributeName) {
    return attributeName.startsWith("v-");
}

/**
 * 判断是否事件绑定指令缩写，@click
 * @param attributeName 元素属性名称
 * @returns 是否事件绑定指令缩写
 */
Compile.prototype.isEventName = function (attributeName) {
    return attributeName.startsWith("@");
}
```

由于处理指令和插值表达式的操作比较多，我们用一个工具类**CompileUtils**来封装。

```js
/**
 * 指令处理工具类
 */
var CompileUtils = {
    /**
     * 编译v-text指令或者插值表达式，因为都是纯文本处理，所以写在一起了
     * @param documentFragment 文档碎片对象
     * @param text 文本
     */
    text: function (vm, documentFragment, text) {
        var value;
        // 判断是否插值表达式
        if (CompileUtils.hasInterpolation(text)) {
            // {{xxxx}}的情况
            value = this.getIterpolutionText(vm, documentFragment, text, true);
        } else {
            // v-text的情况
            value = CompileUtils.getValue(vm, text);
        }
        documentFragment.textContent = value;
    },
    /**
     * 编译v-html指令
     * @param documentFragment 文档碎片对象
     * @param text HTML文本
     */
    html: function (vm, documentFragment, text) {
        var value = CompileUtils.getValue(vm, text);
        documentFragment.innerHTML = value;
    },
    /**
     * 编译v-model指令，要实现双向绑定
     * @param documentFragment 文档碎片对象
     * @param text 值
     */
    model: function (vm, documentFragment, text) {
        var _this = this;
        var value = CompileUtils.getValue(vm, text);
        documentFragment.value = value;
    },
    /**
     * 编译v-on指令
     * @param documentFragment 文档碎片对象
     * @param text 事件处理函数
     * @param eventName 事件名称
     */
    on: function (vm, documentFragment, text, eventName) {
        var fn = vm.$options.methods && vm.$options.methods[text]
        // 这里一定要将fn绑定vm，不然在事件处理函数中的this就不是我们想要的vm了
        // 而是触发事件的那个元素本身，我们就不好在里面访问data的数据和调用methods里的方法了
        documentFragment.addEventListener(eventName, fn.bind(vm));
    },
    /**
     * 通过插值表达式，从data中获取对应的数据
     * @param vm Vue实例
     * @param text 插值表达式
     * @returns data中对应的值
     */
    getValue: function (vm, text) {
        // 逐层从vm.$data中获取键对应的值
        // 比如person.name，先获取vm.$data.person，然后获取person.name
        return text.split(".").reduce(function (data, key) {
            return data[key];
        }, vm.$data);
    },
    /**
     * 判断是否含有插值表达式{{xxx}}
     * @param text 字符串
     * @returns 是否含有插值表达式
     */
    hasInterpolation: function (text) {
        return text && text.indexOf("{{") > -1 && text.indexOf("}}") > -1;
    },
    /**
     * 获取替换插值表达式数据后的文本
     * @param documentFragment 文档碎片对象
     * @returns 替换插值表达式数据后的文本
     */
    getIterpolutionText: function (vm, documentFragment, text) {
        var _this = this;
        return text.replace(/\{\{(.+?)\}\}/g, function (...agrs) {
            return CompileUtils.getValue(vm, agrs[1]);
        });
    }
}
```

本来的实现是想用switch的方式来判断每个指令做相应的处理的，但是源代码的写法是这样，瞬间觉得自己好low-_-

```js
// apply post-transforms
for (let i = 0; i < postTransforms.length; i++) {
  postTransforms[i](element, options)
}
```

所以就改成了现在的写法了：

```js
// 根据指令调用相应方法
CompileUtils[directiveName](this.vm, documentFragment, attributeValue, eventName);
```

还有**CompileUtils.getIterpolutionText**这个方法，本来是用**substring**来各种截取字符串把双大括号中的字符串取出来，然后替换，如果一个文本存在多个插值表达式，还递归替换，然后我又看到了正则表达式，就变成了短短几行^_^

```js
getIterpolutionText: function (vm, documentFragment, text) {
    var _this = this;
    return text.replace(/\{\{(.+?)\}\}/g, function (...agrs) {
        return CompileUtils.getValue(vm, agrs[1]);
    });
}
```

> 多看大框架的源代码确实会学习到很多优雅的编码方式和优秀的设计思路。

模板编译的功能基本实现了，这时我们可以在入口函数中添加Compile的实例化代码就可以实现模板编译了。

```js
/**
 * Vue入口
 * @param options 配置参数
 */
function MyVue(options) {
    this.$el = options.el;
    this.$data = options.data;
    this.$options = options;

    if (!this.$el) throw new Error("el是必须传入的");

    // 1.实现观察者
    // 2.实现指令解释器
    new Compile(this.$el, this);
}
```

将index.html引入vue.js的地方改成引入自己的MyVue.js试试效果，就会惊喜的发现^_^

![输入图片说明](https://images.gitee.com/uploads/images/2020/0724/181115_a65b8b17_5449551.png "屏幕截图.png")

> 到这里我们已经将Compile初始化视图的功能实现啦，但是离我们的目标还远着呢，接下来我们看看Observer怎么劫持属性的吧。