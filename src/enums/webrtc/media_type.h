#pragma once

#include <webrtc/api/media_types.h>

// IWYU pragma: no_include "src/enums/macros/impls.h"

// FIXME(mroberts): I'm not sure that "data" should be valid.
#define CRICKET_MEDIA_TYPE webrtc::MediaType
#define CRICKET_MEDIA_TYPE_NAME "kind"
#define CRICKET_MEDIA_TYPE_LIST \
  ENUM_SUPPORTED(CRICKET_MEDIA_TYPE::AUDIO, "audio") \
  ENUM_SUPPORTED(CRICKET_MEDIA_TYPE::VIDEO, "video") \
  ENUM_SUPPORTED(CRICKET_MEDIA_TYPE::DATA, "data") \
  ENUM_SUPPORTED(CRICKET_MEDIA_TYPE::UNSUPPORTED, "unsupported")


#define ENUM(X) CRICKET_MEDIA_TYPE ## X
#include "src/enums/macros/decls.h"
#undef ENUM
