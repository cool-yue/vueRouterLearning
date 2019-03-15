/* @flow */

export function resolvePath (
  relative: string,
  base: string,
  append?: boolean
): string {
  // 拿到relative的第一个字符
  const firstChar = relative.charAt(0)
  if (firstChar === '/') {
    // 如果第一个字符是'/'开始,直接返回
    return relative
  }
  // 如果第一个字符是?和#,那么说明这个relative字符串属于queryString或者hash
  // 跟base拼接起来然后返回
  if (firstChar === '?' || firstChar === '#') {
    return base + relative
  }

  // 将base的字符串以'/'切成数组
  const stack = base.split('/')

  // remove trailing segment if:
  // - not appending
  // - appending to trailing slash (last segment is empty)
  // 如果没有设置append或者base最后是/
  if (!append || !stack[stack.length - 1]) {
    // 把最后的""弹出数组
    stack.pop()
  }

  // resolve relative path
  // 把相对路径中的起始/替换掉,然后再用split以/来切成数组
  const segments = relative.replace(/^\//, '').split('/')
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (segment === '..') {
      // 如果segment是..,stack就执行pop
      stack.pop()
    } else if (segment !== '.') {
      // 如果segement不是..也不是.那么就直接把
      // segement push到statck中
      stack.push(segment)
    }
  }

  // ensure leading slash
  // 最后只要stack[0] !== ""
  // 那么最后的join起来的话,起始就不会有/
  // 那么在stack最开始的位置插入""
  if (stack[0] !== '') {
    stack.unshift('')
  }
  // 最后将stack里面的值join起来
  return stack.join('/')
}

// 解析路径
export function parsePath (path: string): {
  path: string;
  query: string;
  hash: string;
} {
  // 先将hash和query初始化为''
  let hash = ''
  let query = ''

  // 拿到#在path中的位置
  const hashIndex = path.indexOf('#')
  // 如果找到了"#"
  if (hashIndex >= 0) {
    // 把hash切出来
    hash = path.slice(hashIndex)
    // 把path切出来
    path = path.slice(0, hashIndex)
  }

  // 找到path中的?的位置
  const queryIndex = path.indexOf('?')
  // 如果?在path中存在
  if (queryIndex >= 0) {
    // 拿到?后面的query,不包括?
    // 拿到path,因为前面的path可能包括query
    // 所以先处理hash再处理query
    query = path.slice(queryIndex + 1)
    path = path.slice(0, queryIndex)
  }

  // 最后返回一个对象
  return {
    path,
    query,
    hash
  }
}

// 将//替换成/
export function cleanPath (path: string): string {
  return path.replace(/\/\//g, '/')
}
