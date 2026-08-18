#pragma once

#include <mutex>
#include <queue>

#include <node-addon-api/napi.h>

#include "src/node/deferrer.h"

namespace node_webrtc {

class AsyncContextReleaser
  : public Napi::ObjectWrap<AsyncContextReleaser>
  , private Deferrer {
 public:
  AsyncContextReleaser(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<AsyncContextReleaser>(info)
    , Deferrer(info.Env()) {}

  ~AsyncContextReleaser() override {
    // Other ObjectWrap finalizers can run after this singleton during Node
    // environment teardown. Do not leave them with a dangling pointer.
    _default = nullptr;
    _shutting_down = true;
  }

  static AsyncContextReleaser* GetDefault();
  static void Init(Napi::Env, Napi::Object);
  static void Shutdown();

  void Release(Napi::AsyncContext*);

 protected:
  void Execute(Napi::Env) override;

 private:
  static AsyncContextReleaser* _default;
  static bool _shutting_down;
  static Napi::FunctionReference& constructor();

  std::queue<Napi::AsyncContext*> _contexts;
  std::mutex _contexts_mutex{};
};

}  // namespace node_webrtc
