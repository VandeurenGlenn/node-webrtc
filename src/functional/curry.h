/* Copyright (c) 2019 The node-webrtc project authors. All rights reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be found
 * in the LICENSE.md file in the root of the source tree. All contributing
 * project authors may be found in the AUTHORS file in the root of the source
 * tree.
 */

/*
 * This file defines a function for currying functions. It is borrowed from
 * https://stackoverflow.com/a/26768388
 */

#pragma once

#include <functional>

namespace curry_detail {

template <typename FUNCTION>
struct Curry;

// specialization for functions with a single argument
template <typename R, typename T>
struct Curry<std::function<R(T)>> {
  using type = std::function<R(T)>;

  const type result;

  explicit Curry(type fun): result(fun) {}
};

// recursive specialization for functions with more arguments
template <typename R, typename T, typename...Ts> struct
Curry<std::function<R(T, Ts...)>> {
  using remaining_type = typename Curry<std::function<R(Ts...)>>::type;

  using type = std::function<remaining_type(T)>;

  const type result;

  explicit Curry(const std::function<R(T, Ts...)>& fun): result(
        [ = ](const T & t) {
    return Curry<std::function<R(Ts...)>>(
    [ = ](const Ts & ...ts) {
      return fun(t, ts...);
    }
        ).result;
  }
  ) {}
};

}  // namespace curry_detail

template <typename R, typename...Ts>
auto curry(const std::function<R(Ts...)>& fun) -> typename curry_detail::Curry<std::function<R(Ts...)>>::type {
  return curry_detail::Curry<std::function<R(Ts...)>>(fun).result;
}

template <typename R, typename...Ts>
auto curry(R(* const fun)(Ts...)) -> typename curry_detail::Curry<std::function<R(Ts...)>>::type {
  return curry_detail::Curry<std::function<R(Ts...)>>(fun).result;
}
