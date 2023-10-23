# super-tiny-browser

## 前置知识

### 有限状态机

1. 有限状态机（Finite-State Machine）
    - 有限状态机是一种抽象的模型，描述了对象的状态转换以及这些转换的触发条件。
2. 每一个状态都是一个机器
   - 在每一个机器里面，我们可以做计算、存储、输出
   - 所有的这些机器接受的输入是一致的
   - 状态机的每一个机器本身没有状态，如果我们用函数来表示的话，
     那么函数的参数就是状态，函数的返回值就是输出，且应该是一个纯函数。
3. 状态机可以分为 Moore 状态机和 Mealy 状态机
   - Moore 状态机：状态的转换只发生在当前状态和下一个状态之间，
     且状态的转换不会对输入产生影响，每个机器都有确定的下一个状态：Moore。
   - Mealy 状态机：状态的转换不仅发生在当前状态和下一个状态之间，
     且状态的转换会对输入产生影响。每个机器根据输入的当前状态，可以得到下一个状态：Mealy

4. Js 中的有限状态机
```js
// 每一个函数都可以是一个状态
function state(input) // 函数参数就是输入
{
  // 在函数中，可以自由地编写代码，处理每个状态的逻辑
  // mealy 型状态机 一定是在条件判断型语句(if eles || while)中返回
  return next; // 返回值做为下一个状态
}

// ----- 以下是调用
while(input){
  state = state(input) // 把状态机返回值做为下一个状态
}

// state = state(input) 通过这种方式来让状态机接受输入并且完成状态切换
// 这样 state 中就会永远表示当前状态。
// 无论任何方法获取了一个 input 之后，它都会进行一次状态迁移，并且完成每个
// 状态中所需要完成的计算
```
- 使用状态机，在一个字符串中查找目标字母：
```js
// abcdefg => def
function match(str) {
  let state = start
  for(let c of str){
    state = state(c)
  }
  return state === end
}

function start(c) {
  if(c === d){
    return foundD 
  } else {
    return start(c)
  }
}

function foundD(c) {
  if(c === 'd'){
    return foundE
  } else {
    return start(c)
  }
}

function foundE(c) {
  if(c === 'e'){
    return foundF
  } else {
    return start(c)
  }
}

function foundF(c) {
  if(c === 'f'){
    return end
  } else {
    return start(c)
  }
}
// trap
function end(c) {
  return end
}
```
