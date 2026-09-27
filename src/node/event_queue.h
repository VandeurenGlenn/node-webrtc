/* Copyright (c) 2019 The node-webrtc project authors. All rights reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be found
 * in the LICENSE.md file in the root of the source tree. All contributing
 * project authors may be found in the AUTHORS file in the root of the source
 * tree.
 */
#pragma once

#include <memory>
#include <mutex>
#include <queue>

#include "events.h"

namespace node_webrtc {

/**
 * EventQueue is a thread-safe Event queue. It allows you to enqueue events
 * from one thread and dequeue them from another (or the same).
 * @tparam T the Event target type
 */
template <typename T>
class EventQueue {
 public:
  /**
   * Enqueue an Event.
   * @param event the event to enqueue
   */
  void Enqueue(std::unique_ptr<Event<T>> event) {
    std::lock_guard<std::mutex> lock(_mutex);
    _events.push(std::move(event));
  }

  /**
   * Attempt to dequeue an Event. If the EventQueue is empty, this method
   * returns nullptr.
   * @return the dequeued Event or nullptr
   */
  std::unique_ptr<Event<T>> Dequeue() {
    std::lock_guard<std::mutex> lock(_mutex);
    if (_events.empty()) {
      return nullptr;
    }
    auto event = std::move(_events.front());
    _events.pop();
    return event;
  }

  bool IsEmpty() {
    std::lock_guard<std::mutex> lock(_mutex);
    return _events.empty();
  }

 private:
  std::queue<std::unique_ptr<Event<T>>> _events;
  std::mutex _mutex{};
};

}  // namespace node_webrtc
