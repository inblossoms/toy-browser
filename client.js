const net = require('net')
// 信息收集
class Request{
  constructor(opts) {
    this.method = opts.method || "GET"
    this.host = opts.host
    this.port = opts.port || 80
    this.path = opts.path || '/'
    this.headers = opts.headers || {}
    this.body = opts.body || {}

    // http 协议中，headers 必须包含 Content-type 否者是无法解析的
    if(!this.headers['Content-Type']){
      this.headers["Content-Type"] = "application/x-www-form-urlencoded"
    }

    if(this.headers["Content-Type"] === 'application/json'){
      this.bodyText = JSON.stringify(this.body)
    } else if(this.headers["Content-Type"] === 'application/x-www-form-urlencoded'){
      this.bodyText = Object.keys(this.body).map(key => `${key} = ${encodeURIComponent(this.body[key])}`).join('&')
    }
    this.headers['Content-Length'] = this.bodyText.length
  }

  // 将请求真实发送到服务器 -> Promise
  send(){
    return new Promise((resolve, reject)=>{
        const parser = new ResponseParser
        resolve("")
    })
  }
}

class ResponseParser{
  constructor(string){
    // 循环 + receiverChar 实现状态机对字符串的处理
    receive(string){
      for (let i = 0; i < string.length; i++){
        this.receiverChar(string.charAt(i))
      }
    }
  }
  // 状态机
  receiverChar(char){
    //
  }
}


// 从使用的角度上来设计接口的形式
void async function(){
  let request = new Request({
    method: "POST",
    host: "127.0.0.1",
    port: "8080",
    path: "/",
    headers: {
      ['X-Foo2']: "customed"
    },
    body: {
      name: 'inblossoms'
    }
  })

  let response = await request.send()
  console.log(response)
}()
