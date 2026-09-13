option(WEBRTC_MODERN_APPLE_COMPAT "Enable compatibility flags for modern Xcode/SDK on macOS" ON)
option(WEBRTC_USE_SYSTEM_XCODE_CLANG "Use Xcode clang toolchain for libwebrtc on macOS" OFF)

list(APPEND GN_GEN_ARGS
  use_custom_libcxx=false
  use_custom_libcxx_for_host=false
)
if(WEBRTC_MODERN_APPLE_COMPAT)
  list(APPEND GN_GEN_ARGS
    treat_warnings_as_errors=false
    fatal_linker_warnings=false
  )
endif()
if(WEBRTC_USE_SYSTEM_XCODE_CLANG)
  if(DEFINED ENV{DEVELOPER_DIR} AND NOT "$ENV{DEVELOPER_DIR}" STREQUAL "")
    set(apple_clang_base_path "$ENV{DEVELOPER_DIR}/Toolchains/XcodeDefault.xctoolchain/usr")
  else()
    execute_process(
      COMMAND xcrun --find clang
      OUTPUT_VARIABLE apple_clang_path
      OUTPUT_STRIP_TRAILING_WHITESPACE
      RESULT_VARIABLE apple_clang_result
    )
    if(apple_clang_result EQUAL 0)
      get_filename_component(apple_clang_bin_dir "${apple_clang_path}" DIRECTORY)
      get_filename_component(apple_clang_base_path "${apple_clang_bin_dir}" DIRECTORY)
    endif()
  endif()
  if(apple_clang_base_path)
    list(APPEND GN_GEN_ARGS
      clang_base_path="${apple_clang_base_path}"
      clang_use_chrome_plugins=false
    )
  endif()
endif()
if(DEFINED ENV{SDKROOT} AND NOT "$ENV{SDKROOT}" STREQUAL "")
  list(APPEND GN_GEN_ARGS mac_sdk_path="$ENV{SDKROOT}")
endif()
