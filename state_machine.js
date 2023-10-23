function match(str) {
  let state = start
  for(let c of str){
    state = state(c)
  }
  return state === end
}

function start(c) {
  if(c === 'd'){
    return foundD
  } else {
    return start(c)
  }
}

function foundD(c) {
  if(c === 'e'){
    return foundE
  } else {
    return start(c)
  }
}

function foundE(c) {
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

console.log(match('defg'), '---');

function match_(string) {
  let state = start_
  for(let c of string){
    state = state(c)
  }
  return state === end
}

function start_(c) {
  if(c === 'a'){
    return foundA
  } else {
    return start
  }
}

function end(c) {
  return end
}
function foundA(c) {
  if(c === 'b'){
    return foundB
  } else {
    return start_(c)
  }
}

function foundB(c) {
  if(c === 'c'){
    return foundC
  } else {
    return start_(c)
  }
}

function foundC(c) {
  if(c === 'a'){
    return foundA2
  } else {
    return start_(c)
  }
}

function foundA2(c) {
  if(c === "b"){
    return  foundB2
  } else {
    return  start_(c)
  }
}

function foundB2(c) {
  if(c === 'x'){
    return end
  }else {
    return foundB(c)
  }
}

console.log(match_('abcabcabx'))

function match__(str) {
  let state = start__
  for(let c of str){
    state = state(c)
  }
  return state === end
}

function start__(c) {
  if(c === 'a'){
    return foundA__
  } else {
    return start__
  }
}

function foundA__(c) {
  if(c === 'b'){
    return foundB__
  } else {
    return start__(c)
  }
}

function foundB__(c) {
  if(c === 'a'){
    return  foundNextA
  } else {
    return  start__(c)
  }
}

function foundNextA(c) {
  if(c === 'x'){
    return end
  } else {
    return foundA__(c)
  }
}

console.log(match__('ababax'))
