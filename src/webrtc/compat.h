#pragma once

#include <webrtc/api/scoped_refptr.h>
#include <webrtc/rtc_base/buffer.h>

// WebRTC moved these foundational ownership and buffer types from rtc:: to
// webrtc::. Keep the legacy namespace inside the addon while its public
// wrappers are migrated independently.
namespace rtc {

template <typename T>
using scoped_refptr = webrtc::scoped_refptr<T>;

using Buffer = webrtc::Buffer;

template <typename T, bool ZeroOnFree = false>
using BufferT = webrtc::BufferT<T, ZeroOnFree>;

}  // namespace rtc
