/* Copyright (c) 2019 The node-webrtc project authors. All rights reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be found
 * in the LICENSE.md file in the root of the source tree. All contributing
 * project authors may be found in the AUTHORS file in the root of the source
 * tree.
 */
#include "src/interfaces/rtc_peer_connection/rtc_stats_collector.h"

#include <webrtc/api/stats/rtc_stats_report.h>
#include <mutex>
#include <uv.h>

#include "src/dictionaries/webrtc/rtc_stats_report.h"  // IWYU pragma: keep
#include "src/interfaces/rtc_peer_connection.h"
#include "src/node/utility.h"

namespace node_webrtc {

// One-shot delivery is independent of the peer's event loop, which Close stops.
// No Node or libuv worker thread waits for WebRTC's signaling-thread callback.
struct RTCStatsDelivery {
  RTCStatsDelivery(RTCPeerConnection* peer, Napi::Promise::Deferred promise)
    : owner(peer), deferred(promise), context(promise.Env(), "RTCStatsReport") {}

  uv_async_t async{};
  RTCPeerConnection* owner;
  Napi::Promise::Deferred deferred;
  Napi::AsyncContext context;
  std::mutex mutex;
  rtc::scoped_refptr<webrtc::RTCStatsReport> report;
};

RTCStatsCollector::RTCStatsCollector(RTCPeerConnection* peer, Napi::Promise::Deferred deferred)
  : _delivery(nullptr) {
  auto delivery = new RTCStatsDelivery(peer, deferred);
  uv_loop_t* loop = nullptr;
  auto status = napi_get_uv_event_loop(deferred.Env(), &loop);
  if (status != napi_ok || uv_async_init(loop, &delivery->async, [](uv_async_t* handle) {
    auto result = static_cast<RTCStatsDelivery*>(handle->data);
    Napi::HandleScope scope(result->deferred.Env());
    Napi::CallbackScope callbackScope(result->deferred.Env(), result->context);
    rtc::scoped_refptr<webrtc::RTCStatsReport> report;
    {
      std::lock_guard<std::mutex> lock(result->mutex);
      report = std::move(result->report);
    }
    uv_close(reinterpret_cast<uv_handle_t*>(handle), [](uv_handle_t* closed) {
      auto result = static_cast<RTCStatsDelivery*>(closed->data);
      Napi::HandleScope scope(result->deferred.Env());
      result->owner->Unref();
      delete result;
    });
    // Schedule cleanup before conversion, including conversion failures.
    Resolve(result->deferred, report);
  }) != 0) {
    deferred.Reject(Napi::Error::New(deferred.Env(), "Cannot initialize stats delivery").Value());
    delete delivery;
    return;
  }
  delivery->async.data = delivery;
  peer->Ref();
  _delivery = delivery;
}

void RTCStatsCollector::OnStatsDelivered(const rtc::scoped_refptr<const webrtc::RTCStatsReport>& report) {
  {
    std::lock_guard<std::mutex> lock(_delivery->mutex);
    _delivery->report = report->Copy();
    uv_async_send(&_delivery->async);
  }
}

}  // namespace node_webrtc
