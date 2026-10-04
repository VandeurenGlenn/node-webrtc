#pragma once

#include <atomic>
#include <mutex>

#include <node-addon-api/napi.h>
#include <uv.h>

#include "src/node/event_queue.h"
#include "src/node/events.h"

namespace node_webrtc {

template <typename T>
class EventLoop: private EventQueue<T> {
 public:
  virtual ~EventLoop() = default;

  void Dispatch(std::unique_ptr<Event<T>> event) {
    this->Enqueue(std::move(event));
    if (_coalesce_events && _async_pending.exchange(true, std::memory_order_acq_rel)) {
      return;
    }
    std::lock_guard<std::mutex> lock(_lock);
    if (!uv_is_closing(reinterpret_cast<uv_handle_t*>(&_async))) {
      uv_async_send(&_async);
    }
  }

  bool should_stop() const {
    return _should_stop;
  }

 protected:
  EventLoop(Napi::Env env, Napi::AsyncContext* context, T& target, bool coalesceEvents = false)
    : _coalesce_events(coalesceEvents), _context(context), _env(env), _target(target) {
    uv_loop_t* loop;
    auto status = napi_get_uv_event_loop(_env, &loop);
    {
      using Napi::Error;
      NAPI_THROW_IF_FAILED_VOID(_env, status)
    }

    uv_async_init(loop, &_async, [](auto handle) {
      auto self = static_cast<EventLoop<T>*>(handle->data);
      self->Run();
    });

    _async.data = this;
  }

  virtual void DidStop() {
    // Do nothing.
  }

  virtual void Run() {
    Napi::HandleScope scope(_env);
    while (!_should_stop) {
      if (_coalesce_events) {
        auto events = this->TakeAll();
        while (!events.empty()) {
          auto event = std::move(events.front());
          events.pop();
          Napi::CallbackScope callbackScope(_env, *_context);
          event->Dispatch(_target);
          if (_should_stop) {
            break;
          }
        }
      } else {
        while (auto event = this->Dequeue()) {
          Napi::CallbackScope callbackScope(_env, *_context);
          event->Dispatch(_target);
          if (_should_stop) {
            break;
          }
        }
      }

      if (_should_stop) {
        break;
      }

      if (!_coalesce_events) {
        return;
      }

      // Producers skip uv_async_send while a drain is pending. Clear the flag
      // only after draining, then reclaim it if an event arrived just before
      // the clear. An event arriving afterwards observes false and schedules
      // its own wake-up, so neither side of the race can strand queued work.
      _async_pending.store(false, std::memory_order_release);
      if (this->IsEmpty()) {
        return;
      }
      bool expected = false;
      if (!_async_pending.compare_exchange_strong(
              expected, true, std::memory_order_acq_rel)) {
        return;
      }
    }
    if (_should_stop) {
      std::lock_guard<std::mutex> lock(_lock);
      uv_close(reinterpret_cast<uv_handle_t*>(&_async), [](auto handle) {
        auto self = static_cast<EventLoop<T>*>(handle->data);
        self->DidStop();
      });
    }
  }

  virtual void Stop() {
    _should_stop = true;
    Dispatch(Event<T>::Create());
  }

 private:
  uv_async_t _async{};
  std::atomic<bool> _async_pending = {false};
  const bool _coalesce_events;
  Napi::AsyncContext* _context;
  Napi::Env _env;
  std::mutex _lock{};
  std::atomic<bool> _should_stop = {false};
  T& _target;
};

}  // namespace node_webrtc
