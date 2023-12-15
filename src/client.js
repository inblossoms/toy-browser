const net = require("net");
const parser = require("./parser.js");
const render = require("./render.js");
const images = require("images");

class Request {
  constructor(options) {
    this.method = options.method || "GET";
    this.host = options.host;
    this.port = options.port || 80;
    this.path = options.path || "/";
    this.body = options.body || {};
    this.headers = options.headers || {};
    if (!this.headers["Content-Type"]) {
      this.headers["Content-Type"] = "application/x-www-form-urlencoded"; // http 请求需要通过 headers 来解析 body
    }
    // 这里我们提供了两种编码方式 （常用的有四种
    if (this.headers["Content-Type"] === "application/json") {
      this.bodyText = JSON.stringify(this.body);
    } else if (
      this.headers["Content-Type"] === "application/x-www-form-urlencoded"
    ) {
      this.bodyText = Object.keys(this.body)
        .map((key) => `${key}=${encodeURIComponent(this.body[key])}`)
        .join("&");
    }
    // console.log("this.headers", this.headers);

    this.headers["Content-length"] = this.bodyText.length;
  }

  // 发送请求到服务器 return promise
  send(connection) {
    return new Promise((resolve, reject) => {
      const parser = new ResponseParser();
      //   console.log("this:", this);
      // 设计支持已有的 connection 或者自定义新建 connection
      if (connection) {
        connection.write(this.toString());
      } else {
        connection = net.createConnection(
          // 参数没有传的话 就创建一个 tcp 连接
          {
            host: this.host,
            port: this.port,
          },
          () => {
            // console.log("connection:", connection);

            connection.write(this.toString()); // 创建成功后 将内容写入
          }
        );
      }
      // 服务端返回的 数据
      connection.on("data", (data) => {
        // 将数据传递给 parser 解析， 通过 parser 状态 resolve Promise
        parser.receive(data.toString());
        if (parser.isFinished) {
          resolve(parser.response);
        }
        connection.end(); // 关闭连接
      });
      connection.on("error", (err) => {
        reject(err);
        connection.end();
      });
    });
  }

  //
  toString() {
    return `${this.method} ${this.path} HTTP/1.1\r${Object.keys(this.headers)
      .map((key) => `${key}: ${this.headers[key]}`)
      .join("\r\n")}\r
     \r
    ${this.bodyText}`;
  }
}

/**
 * 接收 response 响应文本并且进行分析
 * response 需要以分段方式构建，所以这里用 ResponseParse（分段处理 ResponseText，
 *        我们用状态机分析了文本结构） 进行装配
 */
class ResponseParser {
  constructor() {
    // 状态机设计
    // status line: HTTP/1.1 200 OK
    // 会以 \r\n 去做结束
    this.WAITING_STATUS_LINE = 0; // \r
    this.WAITING_STATUS_LINE_END = 1; // \n
    this.WAITING_HEADER_NAME = 2;
    this.WAITING_HEADER_SPACE = 3;
    this.WAITING_HEADER_VALUE = 4;
    this.WAITING_HEADER_LINE_END = 5;
    this.WAITING_HEADER_BLOCK_END = 6;
    this.WAITING_BODY = 7;
    // 解析的当前状态
    this.current = this.WAITING_STATUS_LINE;
    this.statusLine = "";
    this.headers = {};
    this.headerName = "";
    this.headerValue = "";
    this.bodyParser = null;
  }

  get isFinished() {
    return this.bodyParser && this.bodyParser.isFinished;
  }

  get response() {
    this.statusLine.match(/HTTP\/1.1 ([0-9]+) ([\s\S]+)/);
    return {
      statusCode: RegExp.$1,
      statusText: RegExp.$2,
      headers: this.headers,
      body: this.bodyParser.content.join(""),
    };
  }

  // string:
  receive(string) {
    for (let i = 0; i < string.length; i++) {
      this.receiveChar(string.charAt(i));
    }
  }

  // status line 解析状态机
  receiveChar(char) {
    if (this.current === this.WAITING_STATUS_LINE) {
      if (char === "\r") {
        this.current = this.WAITING_STATUS_LINE_END;
      } else {
        this.statusLine += char;
      }
    } else if (this.current === this.WAITING_STATUS_LINE_END) {
      if (char === "\n") {
        this.current = this.WAITING_HEADER_NAME;
      }
    } else if (this.current === this.WAITING_HEADER_NAME) {
      if (char === ":") {
        this.current = this.WAITING_HEADER_SPACE;
      } else if (char === "\r") {
        this.current = this.WAITING_HEADER_BLOCK_END;
        // 此时 body 的数据已经完全接收到了
        if (this.headers["Transfer-Encoding"] === "chunked")
          this.bodyParser = new TrunkedBodyParser();
      } else {
        this.headerName += char;
      }
    } else if (this.current === this.WAITING_HEADER_SPACE) {
      if (char === " ") {
        this.current = this.WAITING_HEADER_VALUE;
      }
    } else if (this.current === this.WAITING_HEADER_VALUE) {
      if (char === "\r") {
        this.current = this.WAITING_HEADER_LINE_END;
        this.headers[this.headerName] = this.headerValue;
        this.headerName = "";
        this.headerValue = "";
      } else {
        this.headerValue += char;
      }
    } else if (this.current === this.WAITING_HEADER_LINE_END) {
      if (char === "\n") {
        this.current = this.WAITING_HEADER_NAME;
      }
    } else if (this.current === this.WAITING_HEADER_BLOCK_END) {
      if (char === "\n") {
        this.current = this.WAITING_BODY;
      }
    } else if (this.current === this.WAITING_BODY) {
      this.bodyParser.receiveChar(char);
    }
  }
}

// 会根据 Content-Type 有不同的结构 这里采用子 parser 的结构进行解决
// 子 Parser： TrunkedBodyParser，同样使用了状态机对 body 的格式处理
class TrunkedBodyParser {
  constructor() {
    // trunk.length + trunk content
    this.WAITING_LENGTH = 0;
    this.WAITING_LENGTH_LINE_END = 1;
    //
    this.READING_TRUNK = 2;
    this.WAITING_NEW_LINE = 3;
    this.WAITING_NEW_LINE_END = 4;
    this.length = 0;
    this.content = [];
    this.isFinished = false;
    this.current = this.WAITING_LENGTH;
  }

  receiveChar(char) {
    if (this.current === this.WAITING_LENGTH) {
      if (char === "\r") {
        if (this.length === 0) {
          this.isFinished = true; // 长度为 0 的 trunk， 通知上级这里的解析结束
          // 不知道合不合理 是否应该return
          return;
        }
        this.current = this.WAITING_LENGTH_LINE_END;
      } else {
        // 这里拿到 length 是一个 16 进制的数，所以这里通 *16 的方式将最后一位空出来
        this.length *= 16;
        // 转为 10 进制
        this.length += parseInt(char, 16);
      }
    } else if (this.current === this.WAITING_LENGTH_LINE_END) {
      if (char === "\n") {
        this.current = this.READING_TRUNK;
      }
    } else if (this.current === this.READING_TRUNK) {
      this.content.push(char);
      this.length--;
      if (this.length === 0) {
        this.current = this.WAITING_NEW_LINE;
      }
      // 等待新行
    } else if (this.current === this.WAITING_NEW_LINE) {
      if (char === "\r") {
        this.current = this.WAITING_NEW_LINE_END;
      }
    } else if (this.current === this.WAITING_NEW_LINE_END) {
      if (char === "\n") {
        this.current = this.WAITING_LENGTH;
      }
    }
  }
}

// TAG: 在写一些基础库的时候，可以尝试从使用方式来设计它的接口形式
void (async function () {
  let request = new Request({
    method: "POST",
    host: "127.0.0.1",
    port: "8088",
    path: "/",
    headers: { ["X-F002"]: "customed" },
    body: {
      name: "inblossoms",
    },
  });

  let response = await request.send();
  console.log("response", response);
  let dom = parser.parseHTML(response.body);
  console.log(JSON.stringify(dom, null, "    "));
  let viewport = images(800, 600);
  render(viewport, dom);
  viewport.save("viewport.jpg");
})();
