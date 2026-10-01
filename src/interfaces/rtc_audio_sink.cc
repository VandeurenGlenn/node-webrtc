/* Copyright (c) 2019 The node-webrtc project authors. All rights reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be found
 * in the LICENSE.md file in the root of the source tree. All contributing
 * project authors may be found in the AUTHORS file in the root of the source
 * tree.
 */
#include "src/interfaces/rtc_audio_sink.h"

#include <cstdint>
#include <cstring>
#include <limits>
#include <memory>
#include <new>
#include <string>
#include <type_traits>
#include <utility>

#include "src/converters.h"
#include "src/converters/arguments.h"
#include "src/converters/napi.h"
#include "src/dictionaries/node_webrtc/rtc_on_data_event_dict.h"
#include "src/functional/maybe.h"
#include "src/functional/validation.h"
#include "src/interfaces/media_stream_track.h"  // IWYU pragma: keep
#include "src/node/events.h"

namespace node_webrtc {

Napi::FunctionReference& RTCAudioSink::constructor() {
  static Napi::FunctionReference constructor;
  return constructor;
}

RTCAudioSink::RTCAudioSink(const Napi::CallbackInfo& info)
  : AsyncObjectWrapWithLoop<RTCAudioSink>("RTCAudioSink", *this, info) {
  auto env = info.Env();

  if (!info.IsConstructCall()) {
    Napi::TypeError::New(env, "Use the new operator to construct an RTCAudioSink.").ThrowAsJavaScriptException();
    return;
  }

  CONVERT_ARGS_OR_THROW_AND_RETURN_VOID_NAPI(info, track, rtc::scoped_refptr<webrtc::AudioTrackInterface>)

  _track = std::move(track);
  _track->AddSink(this);
}

Napi::Value RTCAudioSink::GetStopped(const Napi::CallbackInfo& info) {
  CONVERT_OR_THROW_AND_RETURN_NAPI(info.Env(), _stopped, result, Napi::Value)
  return result;
}

void RTCAudioSink::Stop() {
  if (_track) {
    _stopped = true;
    _track->RemoveSink(this);
    _track = nullptr;
  }
  AsyncObjectWrapWithLoop<RTCAudioSink>::Stop();
}

Napi::Value RTCAudioSink::JsStop(const Napi::CallbackInfo& info) {
  Stop();
  return info.Env().Undefined();
}

void RTCAudioSink::DispatchError(std::string message) {
  Dispatch(CreateCallback<RTCAudioSink>([this, message = std::move(message)]() {
    auto env = Env();
    Napi::HandleScope scope(env);
    auto event = Napi::Object::New(env);
    event.Set("type", Napi::String::New(env, "error"));
    event.Set("error", Napi::Error::New(env, message).Value());
    MakeCallback("dispatchEvent", { event });
  }));
}

void RTCAudioSink::OnData(
    const void* audio_data,
    int bits_per_sample,
    int sample_rate,
    size_t number_of_channels,
    size_t number_of_frames) {
  if (audio_data == nullptr || bits_per_sample <= 0 || bits_per_sample % 8 != 0) {
    DispatchError("Received invalid audio sample data");
    return;
  }
  if (bits_per_sample > std::numeric_limits<uint8_t>::max()
      || sample_rate <= 0
      || sample_rate > std::numeric_limits<uint16_t>::max()
      || number_of_channels == 0
      || number_of_channels > std::numeric_limits<uint8_t>::max()
      || number_of_frames > std::numeric_limits<uint16_t>::max()) {
    DispatchError("Received audio dimensions outside the supported range");
    return;
  }

  const auto bytes_per_sample = static_cast<size_t>(bits_per_sample / 8);
  if (number_of_frames > std::numeric_limits<size_t>::max() / number_of_channels) {
    DispatchError("Received audio dimensions that overflow the sample buffer");
    return;
  }
  const auto sample_count = number_of_channels * number_of_frames;
  if (sample_count > std::numeric_limits<size_t>::max() / bytes_per_sample) {
    DispatchError("Received audio dimensions that overflow the sample buffer");
    return;
  }
  const auto byte_length = sample_count * bytes_per_sample;
  std::unique_ptr<uint8_t[]> audio_data_copy(new (std::nothrow) uint8_t[byte_length]);
  if (!audio_data_copy) {
    DispatchError("Failed to allocate an audio sample buffer");
    return;
  }
  memcpy(audio_data_copy.get(), audio_data, byte_length);

  Dispatch(CreateCallback<RTCAudioSink>([
             this,
             audio_data_copy = std::move(audio_data_copy),
             bits_per_sample,
             sample_rate,
             number_of_channels,
             number_of_frames
  ]() mutable {
    RTCOnDataEventDict dict({
      audio_data_copy.release(),
      static_cast<uint8_t>(bits_per_sample),
      static_cast<uint16_t>(sample_rate),
      static_cast<uint8_t>(number_of_channels),
      MakeJust<uint16_t>(static_cast<uint16_t>(number_of_frames))
    });

    auto env = Env();
    Napi::HandleScope scope(env);
    auto maybeValue = From<Napi::Value>(std::make_pair(env, dict));
    if (maybeValue.IsInvalid()) {
      DispatchError(maybeValue.ToErrors()[0]);
      return;
    }
    auto object = maybeValue.UnsafeFromValid().ToObject();
    object.Set("type", Napi::String::New(env, "data"));
    MakeCallback("dispatchEvent", { object });
  }));
}

void RTCAudioSink::Init(Napi::Env env, Napi::Object exports) {
  auto func = DefineClass(env, "RTCAudioSink", {
    InstanceAccessor("stopped", &RTCAudioSink::GetStopped, nullptr),
    InstanceMethod("stop", &RTCAudioSink::JsStop)
  });

  constructor() = Napi::Persistent(func);
  constructor().SuppressDestruct();

  exports.Set("RTCAudioSink", func);
}

}  // namespace node_webrtc
