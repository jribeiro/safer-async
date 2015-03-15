# saferAsync

[![Build Status](https://travis-ci.org/jribeiro/safer-async.svg?branch=develop)](https://travis-ci.org/jribeiro/safer-async)

[Async](https://github.com/caolan/async) library is great but it can be quite hard to debug and figure out what's
happening behind the scenes. saferAsync aims to solve this by wrapping the async library functions, providing:
* error handling - [domains](https://nodejs.org/api/domain.html);
* error if callback is called more than once
* timeout for the callback calling - if the callback is not called within the timeout defined
than the callback is manually called using
```js
callback(err)
```
* notification of function start and callback calling - useful for monitoring and tracking how long a function is taking
 to complete

 WIP - check the tests for examples