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

/**
 * 依赖管理器
 */
function Dep() {
    this.subscribers = [];
}

// 当前的目标watcher
Dep.target = null;

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
        Object.keys(data).forEach(key => {
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