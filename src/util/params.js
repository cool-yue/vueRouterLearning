/* @flow */

import { warn } from './warn'
import Regexp from 'path-to-regexp'

// 这里用了第三方库,path-to-regexp
// 具体就是把具体参数填入到路径中以 : 开头的的地方
// 具体可以看后
const regexpCompileCache: {
  [key: string]: Function
} = Object.create(null)

export function fillParams (
  path: string,
  params: ?Object,
  routeMsg: string
): string {
  try {
    const filler =
      regexpCompileCache[path] ||
      (regexpCompileCache[path] = Regexp.compile(path))
    return filler(params || {}, { pretty: true })
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      warn(false, `missing param for ${routeMsg}: ${e.message}`)
    }
    return ''
  }
}


/*
path-to-regexp包

const toPath = pathToRegexp.compile('/user/:id')

toPath({ id: 123 }) //=> "/user/123"
toPath({ id: 'café' }) //=> "/user/caf%C3%A9"
toPath({ id: '/' }) //=> "/user/%2F"

toPath({ id: ':/' }) //=> "/user/%3A%2F"
toPath({ id: ':/' }, { encode: (value, token) => value }) //=> "/user/:/"

const toPathRepeated = pathToRegexp.compile('/:segment+')

toPathRepeated({ segment: 'foo' }) //=> "/foo"
toPathRepeated({ segment: ['a', 'b', 'c'] }) //=> "/a/b/c"

const toPathRegexp = pathToRegexp.compile('/user/:id(\\d+)')

toPathRegexp({ id: 123 }) //=> "/user/123"
toPathRegexp({ id: '123' }) //=> "/user/123"
toPathRegexp({ id: 'abc' }) //=> Throws `TypeError`.
*/