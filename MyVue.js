/**
 * 模板编译器
 * @param el 根节点 
 * @param vm Vue实例
 */
function Compile(el, vm) {
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
    return node.nodeType === 1;
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
        documentFragment.appendChild(firstChild);
    }
    return documentFragment;
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
            // 根据指令调用响应方法
            CompileUtils[directiveName](this.vm, documentFragment, attributeValue, eventName);
            // 删除元素中的指令属性
            documentFragment.removeAttribute(attributeName);
        } else if (this.isEventName(attributeName)) {
            // 如果是事件绑定缩写情况，@click
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
            // 创建订阅者
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
        // 创建订阅者
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
                // 为给个插值表达式对应的属性创建订阅者
                new Watcher(vm, agrs[1], function () {
                    documentFragment.textContent = _this.getIterpolutionText(vm, documentFragment, text, false);
                });
            }
            return CompileUtils.getValue(vm, agrs[1]);
        });
    }
}


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