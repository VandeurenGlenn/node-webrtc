list(APPEND GN_GEN_ARGS
  use_thin_lto=false
  use_thin_archives=false
  use_custom_libcxx=false
  use_custom_libcxx_for_host=false
  treat_warnings_as_errors=false
  fatal_linker_warnings=false
)

if("$ENV{TARGET_ARCH}" STREQUAL "arm" OR "$ENV{TARGET_ARCH}" STREQUAL "arm64")
  list(APPEND GN_GEN_ARGS use_sysroot=true)
else()
  list(APPEND GN_GEN_ARGS use_sysroot=false)
endif()
