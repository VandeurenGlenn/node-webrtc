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
#include <vector>

#include <node-addon-api/napi.h>
#include <webrtc/api/media_stream_interface.h>
#include <webrtc/api/scoped_refptr.h>

#include "src/converters.h"
#include "src/converters/napi.h"
#include "src/node/async_object_wrap_with_loop.h"
#include "src/node/wrap.h"

namespace node_webrtc {

class PeerConnectionFactory;

class MediaStreamTrack
  : public AsyncObjectWrapWithLoop<MediaStreamTrack>
  , public webrtc::ObserverInterface
  , public webrtc::VideoSinkInterface<webrtc::VideoFrame> {
 public:
  explicit MediaStreamTrack(const Napi::CallbackInfo&);

  ~MediaStreamTrack() override;

  static void Init(Napi::Env, Napi::Object);

  // ObserverInterface
  void OnChanged() override;
  void OnFrame(const webrtc::VideoFrame&) override;

  void OnPeerConnectionClosed();
  // Called only on Node's thread. Receiver tracks start muted until RTP arrives.
  void InitializeRemote();
  void SetMuted(bool);

  bool active() { return _ended ? false : _track->state() == webrtc::MediaStreamTrackInterface::TrackState::kLive; }
  PeerConnectionFactory* factory() { return _factory; }
  rtc::scoped_refptr<webrtc::MediaStreamTrackInterface> track() { return _track; }

  static ::node_webrtc::Wrap <
  MediaStreamTrack*,
  rtc::scoped_refptr<webrtc::MediaStreamTrackInterface>,
  PeerConnectionFactory*
  > * wrap();

  static Napi::FunctionReference& constructor();

 protected:
  void Stop() override;

 private:
  static MediaStreamTrack* Create(
      PeerConnectionFactory*,
      rtc::scoped_refptr<webrtc::MediaStreamTrackInterface>);

  Napi::Value GetEnabled(const Napi::CallbackInfo&);
  void SetEnabled(const Napi::CallbackInfo&, const Napi::Value&);
  Napi::Value GetId(const Napi::CallbackInfo&);
  Napi::Value GetKind(const Napi::CallbackInfo&);
  Napi::Value GetReadyState(const Napi::CallbackInfo&);
  Napi::Value GetMuted(const Napi::CallbackInfo&);
  Napi::Value GetSettings(const Napi::CallbackInfo&);
  Napi::Value GetRemote(const Napi::CallbackInfo&);
  void End();

  Napi::Value Clone(const Napi::CallbackInfo&);
  Napi::Value JsStop(const Napi::CallbackInfo&);

  bool _ended = false;
  std::mutex _settingsMutex;
  int _width = 0;
  int _height = 0;
  int64_t _lastFrameTimestamp = 0;
  double _frameRate = 0;
  // Node-thread-only source state shared by remote clones. Membership does not
  // own wrappers; stopped tracks detach before their event-loop ref is released.
  struct RemoteSourceState {
    bool muted = true;
    std::vector<MediaStreamTrack*> tracks;
  };
  std::shared_ptr<RemoteSourceState> _remoteSource;
  bool _muted = false;
  bool _enabled;
  PeerConnectionFactory* _factory;
  rtc::scoped_refptr<webrtc::MediaStreamTrackInterface> _track;
};

DECLARE_CONVERTER(MediaStreamTrack*, rtc::scoped_refptr<webrtc::AudioTrackInterface>)
DECLARE_CONVERTER(MediaStreamTrack*, rtc::scoped_refptr<webrtc::VideoTrackInterface>)

DECLARE_TO_AND_FROM_NAPI(MediaStreamTrack*)
DECLARE_FROM_NAPI(rtc::scoped_refptr<webrtc::AudioTrackInterface>)
DECLARE_FROM_NAPI(rtc::scoped_refptr<webrtc::VideoTrackInterface>)

}  // namespace node_webrtc
