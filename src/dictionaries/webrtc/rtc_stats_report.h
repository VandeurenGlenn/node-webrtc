#pragma once

#include <webrtc/api/scoped_refptr.h>

#include "src/converters/napi.h"

namespace webrtc { class RTCStatsReport; }

namespace node_webrtc {

DECLARE_TO_NAPI(rtc::scoped_refptr<webrtc::RTCStatsReport>)

}  // namespace node_webrtc
