const css = require("css");
const EOF = Symbol("EOF"); // eof: end of file
const layout = require("./layout.js");

// let stack = [{ type: "document", children: [] }]; //doms树解析用的栈
let stack = [];
let currentToken = null;
let currentAttribute = null;
let currentTextNode = null;

let rules = [];

/**
 * 添加样式规则的方法
 * @param text
 */
function addCSSRules(text) {
  // 我们对 css 解析用到了 css （现成的库）对样式文本进行词法、语法分析 从而获取 css 的 Ast
  var ast = css.parse(text);
  // console.log(JSON.stringify(ast,null,4));
  rules.push(...ast.stylesheet.rules);
}

// 选择器是否匹配元素 <- id|class|tag ->
// eg: params> elem: body  selector: #myid（最内层的选择器
function match(element, selector) {
  if (!selector || !element.attributes) {
    return false;
  }
  if (selector.charAt(0) == "#") {
    var attr = element.attributes.filter((attr) => attr.name === "id")[0];
    if (attr && attr.value === selector.replace("#", "")) {
      return true;
    }
  } else if (selector.charAt(0) == ".") {
    var attr = element.attributes.filter((attr) => attr.name === "class")[0];
    if (attr && attr.value === selector.replace(".", "")) {
      return true;
    }
  } else {
    if (element.tagName === selector) {
      return true;
    }
  }
  return false;
}

// css 规则根据 specificity 和后来有些的策略进行样式覆盖
// specificity 根据简单选择器相加而成
function specificity(selector) {
  // [0, 0, 0, 0] => [inline, id, class, tag] : 从左向右权重逐级降低
  var p = [0, 0, 0, 0];
  var selectorParts = selector.split(" ");
  // 判断简单选择器
  for (var part of selectorParts) {
    if (part.charAt(0) == "#") {
      p[1] += 1;
    } else if (part.charAt(0) == ".") {
      p[2] += 1;
    } else {
      p[3] += 1;
    }
  }
  return p;
}

function compare(sp1, sp2) {
  if (sp1[0] - sp2[0]) {
    return sp1[0] - sp2[0];
  }
  if (sp1[1] - sp2[1]) {
    return sp1[1] - sp2[1];
  }
  if (sp1[2] - sp2[2]) {
    return sp1[2] - sp2[2];
  }
  return sp1[3] - sp2[3];
}

// 计算css
// 通过 rules 来结合这里拿到的 html 元素进行结合 
function computeCSS(element) {
  // console.log("compute CSS for Element",element);
  // 获取元素父级序列 我们需要获取元素的所有父级元素 来确定样式与元素是否匹配
  var elements = stack.slice().reverse(); 
  if (!element.computedStyle) {
    element.computedStyle = {};
  }
  for (let rule of rules) {
    // selectorParts: 选择器集合 对选择器取反拿到最内层选择器
    var selectorParts = rule.selectors[0].split(" ").reverse();
    // 查看选择器和当前元素 是否可以匹配
    if (!match(element, selectorParts[0])) {
      continue;
    }

    var j = 1;
    // 匹配当前元素的父元素 是否能够与选择器（复合选择器的每一项）匹配，得到完全匹配的 css 规则
    for (var i = 0; i < elements.length; i++) {
      if (match(elements[i], selectorParts[j])) {
        j++;
      }
    }
    if (j >= selectorParts.length) {
      //匹配成功
      matched = true;
    }
    // 一旦选择匹配 就应用选择器到元素上 形成 computedStyle
    // 将 style attrs 抄写到 elem
    if (matched) {
      // console.log("Element", element, "matched rule", rule);
      var sp = specificity(rule.selectors[0]);
      var computedStyle = element.computedStyle;
      for (var declaration of rule.declarations) {
        if (!computedStyle[declaration.property]) {
          computedStyle[declaration.property] = {};
        }

        if (!computedStyle[declaration.property].specificity) {
          computedStyle[declaration.property].value = declaration.value;
          computedStyle[declaration.property].specificity = sp;
        } else if (
          compare(computedStyle[declaration.property].specificity, sp) < 0
        ) {
          // for(var k=0;k<4;k++){
          //     computedStyle[declaration].property[declaration.value][k]+=sp[k];
          // }
          computedStyle[declaration.property].value = declaration.value;
          computedStyle[declaration.property].specificity = sp;
        }
        console.log(element.computedStyle);
      }
    }
  }
}

// 对所有状态机中的装有状态执行完毕后 在 emit 中统一输出
function emit(token) {
  let top = stack[stack.length - 1]; //任何的元素的父元素是它入栈前的栈顶
  // console.log(token);

  if (token.type == "startTag") {
    let element = {
      type: "element",
      children: [],
      attributes: [],
    };
    element.tagName = token.tagName;
    for (let p in token) {
      if (p != "type" && p != "tagName") {
        // css 规则希望在解析到 html 元素在进入到 startTag 的时候就能够被判断（当随着新 css 规则的加入，此规则逐渐松动
        element.attributes.push({
          name: p,
          value: token[p],
        });
      }
    }
    // 每当创建一个元素时 则立即计算 css 规则 （ 理论上：当我们去分析一个元素时，我们的 css 属性已经收集完毕
    // toybrowser 忽略了 body 中的外部 style 
    computeCSS(element);
    // 为开始标签元素时 入栈
    top.children.push(element);
    // element.parent = top; // 修改父级

    if (!token.isSelfClosing) {
      // 自封闭元素 可视为入栈后立刻出栈
      stack.push(element);
    }
    currentTextNode = null;
  } else if (token.type == "endTag") {
    // flex 布局是需要知道目标元素的 我们可以认为它的子元素一定是存在于闭合标签结束之前
    // 所以我们选择排版的时机可以是：endTag
    if (top.tagName != token.tagName) {
      throw new Error("tag start end doesn't match!");
    } else {
      //遇到Style标签时，保存 css 规则 （我们通过调用 CSS Parser 来解析 css
      if (top.tagName === "style") {
        addCSSRules(top.children[0].content);
      }
      // 在结束标签元素 出栈
      stack.pop();
    }
    //计算dom在浏览器显示的位置
    layout(top);
    currentTextNode = null;
  } else if (token.type === "text") {
    // 多个文本节点需要合并
    if (currentTextNode == null) {
      currentTextNode = {
        type: "text",
        content: "",
      };
      top.children.push(currentTextNode);
    }
    currentTextNode.content += token.content;
    // return;
  }
}

function data(c) {
  if (c == "<") {
    return tagOpen;
  } else if (c == EOF) {
    emit({
      type: "EOF",
    });
    return;
  } else {
    // 当非开始、结束的状态，都可以把它理解成是文本节点
    emit({
      type: "text",
      content: c,
    });
    return data;
  }
}
function tagOpen(c) {
  if (c == "/") {
    return endTagOpen;
  } else if (c.match(/^[a-zA-Z]$/)) {
    // 当遇到字母的时候的两种情况：开始元素或自封闭元素
    currentToken = {
      type: "startTag",
      tagName: "",
    };
    return tagName(c);
  } else {
    emit({
      type: "text",
      content: c,
    });
    return data;
  }
}

// 需要区分是
function tagName(c) {
  if (c.match(/^[\t\n\f ]$/)) {
    // html 中有效的四种空白符
    return beforeAttributeName;
  } else if (c == "/") {
    return selfClosingStartTag;
  } else if (c.match(/^[a-zA-Z]$/)) {
    currentToken.tagName += c; //.toLowerCase()；
    return tagName;
  } else if (c == ">") {
    emit(currentToken);
    return data;
  } else {
    currentToken.tagName += c;
    return tagName;
  }
}

function beforeAttributeName(c) {
  if (c.match(/^[\t\n\f ]$/)) {
    return beforeAttributeName;
  } else if (c == "/" || c == ">" || c == EOF) {
    return afterAttributeName(c);
  } else if (c == "=") {
    // 属性开始之前是一个 =，就代表是错误的 没有属性是以 = 开头的
    // return beforeAttributeName;
  } else {
    // return beforeAttributeName;
    currentAttribute = {
      name: "",
      value: "",
    };
    return attributeName(c);
  }
}

function attributeName(c) {
  if (c.match(/^[\t\n\f ]$/) || c == "/" || c == ">" || c == EOF) {
    return afterAttributeName(c);
  } else if (c == "=") {
    return beforeAttributeValue;
  } else if (c == "\u0000") {
  } else if (c == '"' || c == "'" || c == "<") {
  } else {
    currentAttribute.name += c;
    return attributeName;
  }
}

function beforeAttributeValue(c) {
  if (c.match(/^[\t\n\f ]$/) || c == "/" || c == ">" || c == EOF) {
    return beforeAttributeValue;
  } else if (c == '"') {
    return doubleQuotedAttributeValue;
  } else if (c == "'") {
    return singleQuotedAttributeValue;
  } else if (c == ">") {
    //reuturn data
  } else {
    return UnquotedAttributeValue(c);
  }
}

// TODO
// ""
function doubleQuotedAttributeValue(c) {
  if (c == '"') {
    currentToken[currentAttribute.name] = currentAttribute.value;
    return afterQuotedAttributeValue;
  } else if (c == "\u0000") {
  } else if (c == EOF) {
  } else {
    throw new Error(`unexpected charater ${c}`);
  }
}

// ''
function singleQuotedAttributeValue(c) {
  if (c == "'") {
    currentToken[currentAttribute.name] = currentAttribute.value;
    return afterQuotedAttributeValue;
  } else if (c == "\u0000") {
  } else if (c == EOF) {
  } else {
    currentAttribute.value += c;
    return singleQuotedAttributeValue;
  }
}

// <div data-info="hello"class> data-info="hello"class="" 两个属性中间没有隔离的视为错误
function afterQuotedAttributeValue(c) {
  if (c.match(/^[\t\n\f ]$/)) {
    return beforeAttributeName;
  } else if (c == "/") {
    return selfClosingStartTag;
  } else if (c == ">") {
    currentToken[currentAttribute.name] = currentAttribute.value;
    emit(currentToken);
    return data;
  } else if (c == EOF) {
  } else {
    currentAttribute.value += c;
    return doubleQuotedAttributeValue;
  }
}
// 无引号
function UnquotedAttributeValue(c) {
  if (c.match(/^[\t\n\f ]$/)) {
    currentToken[currentAttribute.name] = currentAttribute.value;
    return beforeAttributeName;
  } else if (c == "/") {
    currentToken[currentAttribute.name] = currentAttribute.value;
    return selfClosingStartTag;
  } else if (c == ">") {
    currentToken[currentAttribute.name] = currentAttribute.value;
    emit(currentToken);
    return data;
  } else if (c == "\u0000") {
  } else if (c == '"' || c == "'" || c == "<" || c == "=" || c == "`") {
  } else if (c == EOF) {
  } else {
    currentAttribute.value += c;
    return UnquotedAttributeValue;
  }
}

function selfClosingStartTag(c) {
  if (c == ">") {
    currentToken.isSelfClosing = true;
    emit(currentToken);
    return data;
  } else if (c == "EOF") {
  } else {
  }
}

function endTagOpen(c) {
  if (c.match(/^[a-zA-Z]$/)) {
    currentToken = {
      type: "endTag",
      tagName: "",
    };
    return tagName(c);
  } else if (c == ">") {
  } else if (c == EOF) {
  } else {
  }
}

function afterAttributeName(c) {
  if (c.match(/^[\t\n\f ]$/)) {
    return afterAttributeName;
  } else if (c == "/") {
    return selfClosingStartTag;
  } else if (c == "=") {
    return beforeAttributeValue;
  } else if (c == ">") {
    currentToken[currentAttribute.name] = currentAttribute.value;
    emit(currentToken);
    return data;
  } else if (c == EOF) {
  } else {
    currentToken[currentAttribute.name] = currentToken.value;
    currentAttribute = {
      name: "",
      value: "",
    };
    return attributeName(c);
  }
}

// HTML 标准为我们实现了状态机（可以在 HTML 标准中自行查看：Tokenization
module.exports.parseHTML = function parseHTML(html) {
  stack = [{ type: "document", children: [] }]; //doms树解析用的栈
  let state = data;
  // console.log("parser:",html);
  //词法分析 切换状态机状态
  for (let c of html) {
    state = state(c);
  }
  state = state(EOF);
  return stack[0];
};
