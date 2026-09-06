#pragma once

#include <webrtc/api/scoped_refptr.h>
#include <webrtc/rtc_base/buffer.h>
#include <webrtc/rtc_base/crypto_random.h>
#include <webrtc/rtc_base/ref_counted_object.h>

namespace webrtc {
class NetworkManager;
class PacketSocketFactory;
class Thread;
}  // namespace webrtc

// WebRTC moved these foundational ownership and buffer types from rtc:: to
// webrtc::. Keep the legacy namespace inside the addon while its public
// wrappers are migrated independently.
namespace rtc {

template <typename T>
using scoped_refptr = webrtc::scoped_refptr<T>;

using Buffer = webrtc::Buffer;
using NetworkManager = webrtc::NetworkManager;
using PacketSocketFactory = webrtc::PacketSocketFactory;
using Thread = webrtc::Thread;
using webrtc::CreateRandomUuid;

template <typename T, bool ZeroOnFree = false>
using BufferT = webrtc::BufferT<T, ZeroOnFree>;

template <typename T>
using RefCountedObject = webrtc::RefCountedObject<T>;

}  // namespace rtc
