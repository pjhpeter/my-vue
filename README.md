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

以上流程的对应实现都可以在Vue源码中的**src/core/observer**和**src/compiler**目录中找到。

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
    this.el.append(documentFragment);
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

然后是文本节点：

```js
/**
 * 编译文档节点
 * @param documentFragment 文档碎片对象
 */
Compile.prototype.compileText = function (documentFragment) {
    var textContent = documentFragment.textContent;
    // 判断是否含有插值表达式
    if (CompileUtils.hasInterpolation(textContent)) {
        CompileUtils.text(this.vm, documentFragment, textContent);
    }
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

> 不太了解正则表达式的小伙伴建议看看[这个视频](https://www.bilibili.com/video/BV1ef4y1U7V4)，真的秒懂

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

目前为止MyVue.js完整的代码是这样：

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
    this.el.append(documentFragment);
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

/**
 * 编译文档节点
 * @param documentFragment 文档碎片对象
 */
Compile.prototype.compileText = function (documentFragment) {
    var textContent = documentFragment.textContent;
    // 判断是否含有插值表达式
    if (CompileUtils.hasInterpolation(textContent)) {
        CompileUtils.text(this.vm, documentFragment, textContent);
    }
}

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

> 到这里我们已经将Compile初始化视图的功能实现啦，但是离我们的目标还远着呢，接下来我们看看Observer怎么劫持属性的吧。

### Observer

MyVue.js的代码太多，我们可以新建另外一个Observer.js，其实Complie也可以这样分出来，然后index.html里面要记在MyVue.js之前引入。

Observer.js：

```js
/**
 * 观察者类
 * @param data 要观察的对象
 */
function Observer(data) {
    this.observe(data);
}

/**
 * 观察对象的每个属性变化
 * @param data 要观察的对象 
 */
Observer.prototype.observe = function (data) {
    if (data && typeof data === "object") {
        // 遍历data的所有属性
        Object.keys(data).forEach(key => {
            // 数据劫持
            this.defineReactive(data, key, data[key]);
        });
    }
}

/**
 * 劫持每个属性
 * @param data 对象
 * @param key 键
 * @param value 值
 */
Observer.prototype.defineReactive = function (data, key, value) {
    var _this = this;
    // value可能是对象，递归遍历
    _this.observe(value);
    // 通过Object.defineProperty来劫持属性
    // 在getter和setter方法中添加劫持代码
    Object.defineProperty(data, key, {
        enumerable: true,
        configurable: false,
        set: function (newValue) {
            if (newValue !== value) {
                // 重新劫持新的值
                _this.observe(newValue);
                value = newValue;
            }
        },
        get: function () {
            return value;
        }
    });
}
```

现在在入口函数中添加Observer的实例化代码就可以让它生效了。

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
    new Observer(this.$data);
    // 2.实现指令解释器
    new Compile(this.$el, this);
}
```

当然，现在只是劫持了数据，但是还没有依赖收集器Dep和订阅者Watcher，所以数据变化还不能通知视图更新。

### Dep

在Observer.js里面创建依赖收集器Dep类：

```js
/**
 * 依赖管理器
 */
function Dep() {
    this.subscribers = [];
}

/**
 * 添加订阅者
 * @param watcher 订阅者对象
 */
Dep.prototype.depend = function(watcher) {
    this.subscribers.push(watcher);
}

/**
 * 数据发生变化时，唤醒所有关联的订阅者，更新视图
 */
Dep.prototype.notify = function() {
    this.subscribers.forEach(watcher => {
        watcher.update();
    })
}
```

按照流程图，Dep应该可以管理关联的所有订阅者的，并且在Observer告诉Dep数据发生变化的时候，Dep会通知所有关联的订阅者对象，去更新视图，所以定义了**depend**方法来添加订阅者，以及**notify**方法来通知所有关联的订阅者更新视图。

现在还没有订阅者**Watcher**类，我们在Observer.js中创建一下：

```js
/**
 * 订阅者类
 * @param vm Vue实例
 * @param text 插值表达式文本，如HTML中的"person.name"
 * @param callback 更新对应视图的回调函数
 */
function Watcher(vm, text, callback) {
    this.vm = vm;
    this.text = text;
    this.callback = callback;
    // 获取当前值作为旧值，用于更新时与新值做比较
    this.oldValue = this.get();
}

/**
 * 获取当前的值值
 * @param vm 
 * @param text 
 */
Watcher.prototype.get = function() {
    // 这个方法一旦调用，会触发相关属性的getter
    var value = CompileUtils.getValue(this.vm, this.text);
    return value;
}

/**
 * 更新视图
 */
Watcher.prototype.update = function() {
    // 这里会触发对应属性的getter方法
    var newValue = CompileUtils.getValue(this.vm, this.text);
    if(newValue !== this.oldValue) {
        // 值发生变化时，
        this.callback(newValue);
        // 重置旧值
        this.oldValue = newValue;
    }
}
```

Watcher对象需要保存一个旧值，用于在数据变化的时候对比新值是否发生改变，如果改变了才去更新视图，这样效率会高很多，同时也应该有一个update方法来更新视图，至于针对不同的情况，比如插值表达式和v-html的处理方式是不一样的，所有在Watcher实例化的时候，必须要接收一个对应的更新视图回调函数，在update方法中调用它来更新视图。

> 现在我们有了Dep和Watcher，但是它们之间目前还没有建立依赖关系，Observer也还没法通知Dep数据变化，Watcher也不知道什么时候实例化并且绑定更新视图的回调。下面我们根据开始的流程图来分析一下。

### 建立消息发布和订阅机制

![输入图片说明](https://images.gitee.com/uploads/images/2020/0724/151411_b71f0059_5449551.png "屏幕截图.png")

首先我们通过流程图看到Observer劫持数据后，会监听数据变化，然后通知Dep，而当页面渲染的时候，Complie会从data中读取值渲染到页面中，这个时候Observer会监听到data的相关属性的getter方法被调用，所以这是Dep收集属性依赖的最好时机，因此我们在每个属性的getter方法中为这个属性添加订阅者Watcher。

那么什么时候去触发Watcher的update方法更新视图呢？当时是data属性值被改变是，那就是属性的setter方法被调用的时候，所以我们可以在setter方法中调用Dep的notify方法通知所有依赖的订阅者更新视图。

所以我们可以改写一下数据劫持的代码：

```js
/**
 * 劫持每个属性
 * @param data 对象
 * @param key 键
 * @param value 值
 */
Observer.prototype.defineReactive = function (data, key, value) {
    var _this = this;
    // value可能是对象，递归遍历
    _this.observe(value);
    // 实例化Dep
    var dep = new Dep();
    Object.defineProperty(data, key, {
        enumerable: true,
        configurable: false,
        set: function (newValue) {
            if (newValue !== value) {
                // 重新劫持新的值
                _this.observe(newValue);
                value = newValue;
                // 通知所有订阅者属性有变化
                dep.notify();
            }
        },
        get: function () {
            // 但是这里无法找到对应的Watcher对象
            // 如果在这里new一个Watcher的话
            // 更新视图的回调函数我们也无从得知
            dep.depend(watcher);
            return value;
        }
    });
}
```

但是在getter方法中调用dep.depend的时候，需要传入一个Watcher的实例，而实例化Watcher的时候需要传入对应属性具体的更新视图回调函数，前面讲过，针对不同的指令，更新视图的方式是不一样的，具体情况要有对应的实现，所以唯一能够知道更新视图的具体回调函数的地方只有**CompileUtils**工具类中对应各个指令的处理方法中，在那里new Watcher是最合适的，但是怎么把CompileUtils中实例化的Watcher对象传到数据劫持的getter方法中呢？

这里用了一个小技巧，就是给Dep类定义了一个target属性，指向当前要绑定依赖的Watcher实例，我们可以在Watcher实例化的时候，把当前实例化的对象赋值给**Dep.target**，然后在属性的**getter**那里将Dep.target传入**dep.depend**方法中，绑定依赖之后再清除Dep.target的值，以免getter多次被调用，重复绑定依赖。

讲了那么多思路，肯定会有点混乱，我们先来看看具体代码实现，再对照着上面的思路看应该会稍微清晰一些：

首先给Dep添加target属性：

```js
// 当前的目标Watcher
Dep.target = null;
```

然后在Watcher实例化的时候给Dep.target赋值：

```js
/**
 * 订阅者类
 * @param vm Vue实例
 * @param text 直至表达式文本
 * @param callback 更新对应视图的回调函数
 */
function Watcher(vm, text, callback) {
    this.vm = vm;
    this.text = text;
    this.callback = callback;
    // 获取当前值作为旧值，用于更新时与新值做比较
    this.oldValue = this.get();
}

/**
 * 获取当前的值值
 * @param vm 
 * @param text 
 */
Watcher.prototype.get = function() {
    // 指定当前的Watcher
    Dep.target = this;
    // 这个方法一旦调用，会触发相关属性的getter，在getter中关联Dep和Watcher
    var value = CompileUtils.getValue(this.vm, this.text);
    // 由于在update的时候，也取了一次值
    // 如果这里不情况绑定的订阅者，会出现重复绑定两次的现象
    // 绑定完成之后要清除当前目标
    Dep.target = null;
    return value;
}
```

> 由于JavaScript是单线程语言，每一时刻CPU只会处理一个函数的执行，所以不需要担心Dep.target被其他Watcher污染。

接着在数据劫持的getter方法中将Dep.target添加到依赖收集器中。

```js
/**
 * 劫持每个属性
 * @param data 对象
 * @param key 键
 * @param value 值
 */
Observer.prototype.defineReactive = function (data, key, value) {
    var _this = this;
    // value可能是对象，递归遍历
    _this.observe(value);
    // 实例化Dep
    var dep = new Dep();
    Object.defineProperty(data, key, {
        enumerable: true,
        configurable: false,
        set: function (newValue) {
            if (newValue !== value) {
                // 重新劫持新的值
                _this.observe(newValue);
                value = newValue;
                // 通知所有订阅者属性有变化
                dep.notify();
            }
        },
        get: function () {
            // Watcher实例化的时候就会触发
            // 所以在这里添加依赖，绑定dep和watcher
            if(Dep.target) {
                dep.depend(Dep.target);
            }
            return value;
        }
    });
}
```

最后是在**CompileUtils**中实例化对应的Watcher。

```js
/**
 * 指令处理工具
 */
var CompileUtils = {
    /**
     * 编译v-text指令或者插值表达式
     * @param documentFragment 文档碎片对象
     * @param text 文本
     */
    text: function (vm, documentFragment, text) {
        // 判断是否插值表达式
        var value;
        if (CompileUtils.hasInterpolation(text)) {
            value = this.getIterpolutionText(vm, documentFragment, text, true);
        } else {
            value = CompileUtils.getValue(vm, text);
            // 创建订阅者，绑定视图更新回调函数
            new Watcher(vm, text, function (newValue) {
                documentFragment.textContent = newValue;
            });
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
        // 创建订阅者，绑定视图更新回调函数
        new Watcher(vm, text, function (newValue) {
            documentFragment.innerHTML = newValue;
        });
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
        // 创建订阅者，绑定视图更新回调函数
        new Watcher(vm, text, function (newValue) {
            documentFragment.value = newValue;
        });
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
        // 比如person.name，先获取vm.data.person，然后获取person.name
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
     * @param requiredWatcher 是否需要添加订阅者
     * @returns 替换插值表达式数据后的文本
     */
    getIterpolutionText: function (vm, documentFragment, text, requiredWatcher) {
        var _this = this;
        return text.replace(/\{\{(.+?)\}\}/g, function (...agrs) {
            if (requiredWatcher) {
                // 为每个插值表达式对应的属性创建订阅者，绑定视图更新回调函数
                new Watcher(vm, agrs[1], function () {
                    documentFragment.textContent = _this.getIterpolutionText(vm, documentFragment, text, false);
                });
            }
            return CompileUtils.getValue(vm, agrs[1]);
        });
    }
}
```

> 这里有一点不是那么容易理解，所以不理解就多看几次，自己也写一下，应该就能理解了。

到这里，数据的单向绑定就完成，我们可以到F12的控制台中改变一下vm.$data里面属性的值，会看到视图跟着改变。

![输入图片说明](https://images.gitee.com/uploads/images/2020/0725/142656_fcb31906_5449551.gif "录制_2020_07_25_14_22_48_808.gif")

### 数据双向绑定

前面我们只是实现了数据单向绑定，就是数据改变视图，下面我们需要在v-model指令中添加数据双向绑定的操作，视图也可以改变数据，修改一下**CompileUtils**处理v-model的逻辑就可以了，我们看看代码。

```js
/**
 * 编译v-model指令，要实现双向绑定
 * @param documentFragment 文档碎片对象
 * @param text 值
 */
model: function (vm, documentFragment, text) {
    var _this = this;
    var value = CompileUtils.getValue(vm, text);
    // 创建订阅者
    // 数据>视图
    new Watcher(vm, text, function (newValue) {
        documentFragment.value = newValue;
    });

    // 视图>数据
    // 给元素添加input事件监听，实现视图改变数据
    documentFragment.addEventListener("input", function (event) {
        _this.setValue(vm, text, event.target.value);
    });

    documentFragment.value = value;
},
/**
 * 将输入框的值更新到vm.$data中
 * @param vm Vue实例
 * @param text 插值表达式
 * @param inputValue 输入的值
 */
setValue: function (vm, text, inputValue) {
    // 逐层遍历data
    text.split(".").reduce(function (data, key) {
        if (typeof data[key] !== "object") {
            // 如果data[key]不是对象，直接改变data[key]的值
            data[key] = inputValue;
        } else {
            // 如果data[key]是对象，继续遍历下一层
            return data[key];
        }
    }, vm.$data);
},
```

这时添加了v-model指令的元素修改了值，会同时更新data中对应的属性值，data的属性发生变化，Observer会通知Dep，Dep又会通知所有依赖的订阅者更新视图。

我们在来看看效果：

![输入图片说明](https://images.gitee.com/uploads/images/2020/0725/144353_9d11456f_5449551.gif "录制_2020_07_25_14_42_38_118.gif")

### 数据代理

最后我们再处理一些细节就可以了，平时我们使用Vue的时候，访问数据都是用this.xxx.yyy就可以了，并不需要this.$data.xxx.yyy，这是因为Vue做了数据代理。下面我们也来做一下吧，修改一下入口程序就可以了。

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
    new Observer(this.$data);
    // 2.实现指令解释器
    new Compile(this.$el, this);
    // 3.数据代理，可以通过this.xxx访问this.$data.xxx
    this.proxyData(this);
}

/**
 * 建立数据代理，将this.$data.xxx代理为this.xxx，方便调用
 * @param vm Vue实例
 */
MyVue.prototype.proxyData = function (vm) {
    var data = vm.$data;
    Object.keys(data).forEach(function (key) {
        // 访问vm.xxx的时候重定向到vm.$data.xxx
        Object.defineProperty(vm, key, {
            set: function (newValue) {
                data[key] = newValue;
            },
            get: function () {
                return data[key];
            }
        });
    });
}
```

现在我们就可以通过vm.person.name来访问vm.$data.person.name的值了。

## 总结

其实整个过程没有用到非常高深的东西，都是一些JavaScript基础的应用，这里不得不感慨基础扎实的重要性，然后就是清晰的业务逻辑和简练的设计思想，**我相信不断努力，不断学习，不断总结，就会不断进步，只要肯努力都能成为出色的程序员^_^**

完整的代码链接在[这里](https://gitee.com/pjhpeter/my-vue)，谢谢大家听我唠叨了那么多，哈哈~