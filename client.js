const net = require('net')

// 信息收集
class Request {
  constructor(opts) {
    this.method = opts.method || 'GET'
    this.host = opts.host
    this.port = opts.port || 80
    this.path = opts.path || '/'
    this.headers = opts.headers || {}
    this.body = opts.body || {}

    // http 协议中，headers 必须包含 Content-type 否者是无法解析的
    if (!this.headers['Content-Type']) {
      this.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }

    if (this.headers['Content-Type'] === 'application/json') {
      this.bodyText = JSON.stringify(this.body)
    } else if (this.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
      this.bodyText = Object.keys(this.body).map(key => `${key} = ${encodeURIComponent(this.body[key])}`).join('&')
    }
    this.headers['Content-Length'] = this.bodyText.length
  }

  /*
   * - 设计支持已有的 connection 或者 diy 新的 connectin
   * - 将收到的数据传递给parser
   * - 根据 parser 的状态 resolve Promise
   */

  // 将请求真实发送到服务器 -> Promise
  send(connection) {
    return new Promise((resolve, reject) => {
      const parser = new ResponseParser

      if (connection) {
        connection.write(this.toString())
      } else {
        connection = net.createConnection({
          host: this.host,
          port: this.port
        }, () => {
          connection.write(this.toString())
        })
      }
      connection.on('data', (data) => {
        console.log(data.toString())
        parser.receive(data.toString())
          if (parser.isFinished) {
            resolve(parser.response)
            connection.end()
          }
        }
      )
      connection.on('error', (error) => {
        reject(error)
        connection.end()
      })
    })
  }
  toString(){
    return  `${this.method} ${this.path} HTTP/1.1\r\n
      ${Object.keys(this.headers).map(key => `${key}:${this.headers[key]}`).join('\r\n')}\r\n\r\n
      ${this.bodyText} 
    `
  }
}

class ResponseParser {
  constructor(string) {
    // 循环 + receiverChar 实现状态机对字符串的处理
    function receive(string){
      for (let i = 0; i < string.length; i++) {
        this.receiverChar(string.charAt(i))
      }
    }
  }

  // 状态机
  receiverChar(char) {
    //
  }
}

// 从使用的角度上来设计接口的形式
void async function () {
  let request = new Request({
    method: 'POST',
    host: '127.0.0.1',
    port: '8080',
    path: '/',
    headers: {
      ['X-Foo2']: 'customed'
    },
    body: {
      name: 'inblossoms'
    }
  })

  let response = await request.send()
  console.log(response)
}()
