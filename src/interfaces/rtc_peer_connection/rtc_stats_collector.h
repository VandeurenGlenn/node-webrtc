/* Copyright (c) 2019 The node-webrtc project authors. All rights reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be found
 * in the LICENSE.md file in the root of the source tree. All contributing
 * project authors may be found in the AUTHORS file in the root of the source
 * tree.
 */
#pragma once

#include <node-addon-api/napi.h>
#include <webrtc/api/scoped_refptr.h>
#include <webrtc/api/stats/rtc_stats_collector_callback.h>
namespace webrtc { class RTCStatsReport; }

namespace node_webrtc {

class RTCPeerConnection;
struct RTCStatsDelivery;

class RTCStatsCollector
  : public webrtc::RTCStatsCollectorCallback {
 public:
  RTCStatsCollector(
      RTCPeerConnection* peer_connection,
      Napi::Promise::Deferred deferred);

  bool IsReady() const { return _delivery != nullptr; }

  void OnStatsDelivered(const rtc::scoped_refptr<const webrtc::RTCStatsReport>&) override;

 private:
  RTCStatsDelivery* _delivery;
};

}  // namespace node_webrtc;
