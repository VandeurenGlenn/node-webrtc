# branch-heads/7977 (Chromium/WebRTC M152). Pin the resolved commit so builds do
# not change when upstream updates the release branch.
set(
  WEBRTC_REVISION
  6f37672d358475cd17544121a12494da454d85fb
  CACHE STRING
  "Pinned libwebrtc Git revision"
)

list(APPEND GN_GEN_ARGS
  rtc_build_examples=false
  rtc_use_x11=false
  rtc_enable_protobuf=false
  rtc_include_pulse_audio=false
  rtc_include_tests=false
)
if("$ENV{TARGET_ARCH}" STREQUAL "arm")
  list(APPEND GN_GEN_ARGS
    target_os="linux"
    target_cpu="arm"
    rtc_build_tools=true
    treat_warnings_as_errors=false
    fatal_linker_warnings=false
  )
elseif("$ENV{TARGET_ARCH}" STREQUAL "arm64")
  if(NOT APPLE)
    list(APPEND GN_GEN_ARGS target_os="linux")
  endif()
  list(APPEND GN_GEN_ARGS
    target_cpu="arm64"
    rtc_build_tools=true
    treat_warnings_as_errors=false
    fatal_linker_warnings=false
  )
else()
  list(APPEND GN_GEN_ARGS rtc_build_tools=false)
endif()

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
  list(APPEND GN_GEN_ARGS is_debug=true)
else()
  list(APPEND GN_GEN_ARGS is_debug=false)
endif()
