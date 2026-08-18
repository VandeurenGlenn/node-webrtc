#include "src/node/async_context_releaser.h"

namespace node_webrtc {

AsyncContextReleaser* AsyncContextReleaser::_default = nullptr;
bool AsyncContextReleaser::_shutting_down = false;

Napi::FunctionReference& AsyncContextReleaser::constructor() {
  static Napi::FunctionReference constructor;
  return constructor;
}

void AsyncContextReleaser::Release(Napi::AsyncContext* context) {
  _contexts_mutex.lock();
  _contexts.push(context);
  _contexts_mutex.unlock();
  Queue();
}

void AsyncContextReleaser::Execute(Napi::Env env) {
  _contexts_mutex.lock();
  while (!_contexts.empty()) {
    Napi::HandleScope scope(env);
    auto context = _contexts.front();
    delete context;
    _contexts.pop();
  }
  _contexts_mutex.unlock();
}

AsyncContextReleaser* AsyncContextReleaser::GetDefault() {
  if (!_default && !_shutting_down) {
    Napi::HandleScope scope(constructor().Env());
    auto object = constructor().New({});
    _default = Unwrap(object);
    _default->Ref();
  }
  return _default;
}

void AsyncContextReleaser::Init(Napi::Env env, Napi::Object) {
  _shutting_down = false;
  auto func = DefineClass(env, "AsyncContextReleaser", {});
  constructor() = Napi::Persistent(func);
  constructor().SuppressDestruct();
}

void AsyncContextReleaser::Shutdown() {
  // Environment cleanup can finalize other ObjectWrap instances after this
  // singleton. A null marker makes those late finalizers skip the releaser.
  _default = nullptr;
  _shutting_down = true;
}

}  // namespace node_webrtc
