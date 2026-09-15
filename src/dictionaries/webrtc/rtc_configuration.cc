#include "src/dictionaries/webrtc/rtc_configuration.h"

#include <cstdlib>
#include <string>

#include "src/converters.h"
#include "src/converters/object.h"
#include "src/dictionaries/webrtc/ice_server.h"
#include "src/enums/webrtc/bundle_policy.h"
#include "src/enums/webrtc/ice_transports_type.h"
#include "src/enums/webrtc/rtcp_mux_policy.h"
#include "src/enums/webrtc/sdp_semantics.h"
#include "src/functional/curry.h"
#include "src/functional/operators.h"

namespace node_webrtc {

namespace {

std::string GetSdpSemanticsEnvironment() {
#ifdef _WIN32
  char* value = nullptr;
  size_t size = 0;
  if (_dupenv_s(&value, &size, "SDP_SEMANTICS") != 0 || value == nullptr) {
    return {};
  }
  std::string result(value);
  std::free(value);
  return result;
#else
  const char* value = std::getenv("SDP_SEMANTICS");
  return value == nullptr ? std::string() : std::string(value);
#endif
}

}  // namespace

FROM_NAPI_IMPL(webrtc::PeerConnectionInterface::RTCConfiguration, value) {
  // NOTE(mroberts): Allow overriding the default SdpSemantics via environment variable.
  // Makes web-platform-tests easier to run.
  auto sdp_semantics_str = GetSdpSemanticsEnvironment();
  auto sdp_semantics = From<webrtc::SdpSemantics>(sdp_semantics_str).FromValidation(webrtc::SdpSemantics::kUnifiedPlan);
  return From<Napi::Object>(value).FlatMap<webrtc::PeerConnectionInterface::RTCConfiguration>([sdp_semantics](auto object) {
    return curry(CreateRTCConfiguration)
        % GetOptional<std::vector<webrtc::PeerConnectionInterface::IceServer>>(object, "iceServers", std::vector<webrtc::PeerConnectionInterface::IceServer>())
        * GetOptional<webrtc::PeerConnectionInterface::IceTransportsType>(object, "iceTransportPolicy", webrtc::PeerConnectionInterface::IceTransportsType::kAll)
        * GetOptional<webrtc::PeerConnectionInterface::BundlePolicy>(object, "bundlePolicy", webrtc::PeerConnectionInterface::BundlePolicy::kBundlePolicyBalanced)
        * GetOptional<webrtc::PeerConnectionInterface::RtcpMuxPolicy>(object, "rtcpMuxPolicy", webrtc::PeerConnectionInterface::RtcpMuxPolicy::kRtcpMuxPolicyRequire)
        * GetOptional<std::string>(object, "peerIdentity")
        * GetOptional<std::vector<Napi::Object>>(object, "certificates")
        // TODO(mroberts): Implement EnforceRange and change to uint8_t.
        * GetOptional<uint8_t>(object, "iceCandidatePoolSize", 0)
        * GetOptional<webrtc::SdpSemantics>(object, "sdpSemantics", sdp_semantics);
  });
}

}  // namespace node_webrtc
