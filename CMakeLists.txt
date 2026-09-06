cmake_minimum_required(VERSION 3.12)
project(node-webrtc)

include(ExternalProject)
find_package(Git REQUIRED)
find_package(Threads REQUIRED)
find_program(iwyu_path OPTIONAL NAMES include-what-you-use iwyu)
find_program(clang_tidy_path OPTIONAL NAMES clang-tidy)

set(
  DEPOT_TOOLS_REVISION
  81577f19a8497ba7e41afac322e8f03553a863ec
  CACHE STRING
  "Pinned depot_tools revision used to fetch and build libwebrtc"
)

# depot_tools
# -----------------------------------------------------------------------------

ExternalProject_Add(
  project_depot_tools

  GIT_REPOSITORY    https://chromium.googlesource.com/chromium/tools/depot_tools.git
  GIT_TAG           ${DEPOT_TOOLS_REVISION}

  PREFIX            ${CMAKE_BINARY_DIR}/external/depot_tools/prefix
  TMP_DIR           ${CMAKE_BINARY_DIR}/external/depot_tools/tmp
  STAMP_DIR         ${CMAKE_BINARY_DIR}/external/depot_tools/stamp
  DOWNLOAD_DIR      ${CMAKE_BINARY_DIR}/external/depot_tools/download
  SOURCE_DIR        ${CMAKE_BINARY_DIR}/external/depot_tools/src
  BINARY_DIR        ${CMAKE_BINARY_DIR}/external/depot_tools/build

  CONFIGURE_COMMAND ""
  BUILD_COMMAND     ""
  INSTALL_COMMAND   ""
)

ExternalProject_Get_Property(project_depot_tools SOURCE_DIR)
set(depot_tools_install_dir ${SOURCE_DIR})

set(libwebrtc_binary_dir ${CMAKE_BINARY_DIR}/external/libwebrtc/build/${CMAKE_BUILD_TYPE})
set(libwebrtc_src_dir ${CMAKE_BINARY_DIR}/external/libwebrtc/download/src)

# libwebrtc
# -----------------------------------------------------------------------------

# branch-heads/7977 (Chromium/WebRTC M152). Pin the resolved commit so builds do
# not change when upstream updates the release branch.
set(
  WEBRTC_REVISION
  6f37672d358475cd17544121a12494da454d85fb
  CACHE STRING
  "Pinned libwebrtc Git revision"
)

option(WEBRTC_MODERN_APPLE_COMPAT "Enable compatibility flags for modern Xcode/SDK on macOS" ON)
option(WEBRTC_USE_SYSTEM_XCODE_CLANG "Use Xcode clang toolchain for libwebrtc on macOS" OFF)

list(APPEND GN_GEN_ARGS
  rtc_build_examples=false
  rtc_use_x11=false
  rtc_enable_protobuf=false
  rtc_include_pulse_audio=false
  rtc_include_tests=false
)
if ("$ENV{TARGET_ARCH}" STREQUAL "arm")
  list(APPEND GN_GEN_ARGS
    target_os="linux"
    target_cpu="arm"
    rtc_build_tools=true
    treat_warnings_as_errors=false
    fatal_linker_warnings=false
  )
elseif ("$ENV{TARGET_ARCH}" STREQUAL "arm64")
  if(NOT APPLE)
  list(APPEND GN_GEN_ARGS
    target_os="linux"
  )
  endif()
  list(APPEND GN_GEN_ARGS
    target_cpu="arm64"
    rtc_build_tools=true
    treat_warnings_as_errors=false
    fatal_linker_warnings=false
  )
else()
  list(APPEND GN_GEN_ARGS
    rtc_build_tools=false
  )
endif()

if (WIN32 OR (UNIX AND NOT APPLE))
  list(APPEND GN_GEN_ARGS is_clang=false)
endif()
if (WIN32)
  # The pinned WebRTC/NASM sources emit warnings with current MSVC that were
  # not produced by the compiler version they originally targeted.
  list(APPEND GN_GEN_ARGS
    treat_warnings_as_errors=false
    fatal_linker_warnings=false
  )
endif()
if (UNIX AND NOT APPLE)
  list(APPEND GN_GEN_ARGS
    use_custom_libcxx=false
    use_custom_libcxx_for_host=false
    use_sysroot=false
    treat_warnings_as_errors=false
    fatal_linker_warnings=false
  )
endif()
if (CMAKE_BUILD_TYPE STREQUAL "Debug")
  list(APPEND GN_GEN_ARGS is_debug=true)
else()
  list(APPEND GN_GEN_ARGS is_debug=false)
endif()
if (APPLE)
  list(APPEND GN_GEN_ARGS
    use_custom_libcxx=false
    use_custom_libcxx_for_host=false
  )
  if (WEBRTC_MODERN_APPLE_COMPAT)
    list(APPEND GN_GEN_ARGS
      treat_warnings_as_errors=false
      fatal_linker_warnings=false
    )
  endif()
  if (WEBRTC_USE_SYSTEM_XCODE_CLANG)
    if (DEFINED ENV{DEVELOPER_DIR} AND NOT "$ENV{DEVELOPER_DIR}" STREQUAL "")
      set(apple_clang_base_path "$ENV{DEVELOPER_DIR}/Toolchains/XcodeDefault.xctoolchain/usr")
    else()
      execute_process(
        COMMAND xcrun --find clang
        OUTPUT_VARIABLE apple_clang_path
        OUTPUT_STRIP_TRAILING_WHITESPACE
        RESULT_VARIABLE apple_clang_result
      )
      if (apple_clang_result EQUAL 0)
        get_filename_component(apple_clang_bin_dir "${apple_clang_path}" DIRECTORY)
        get_filename_component(apple_clang_base_path "${apple_clang_bin_dir}" DIRECTORY)
      endif()
    endif()
    if (apple_clang_base_path)
      list(APPEND GN_GEN_ARGS
        clang_base_path="${apple_clang_base_path}"
        clang_use_chrome_plugins=false
      )
    endif()
  endif()
endif()
if (APPLE AND DEFINED ENV{SDKROOT} AND NOT "$ENV{SDKROOT}" STREQUAL "")
  list(APPEND GN_GEN_ARGS mac_sdk_path="$ENV{SDKROOT}")
endif()
string(REPLACE ";" " " GN_GEN_ARGS "${GN_GEN_ARGS}")

set(webrtc_build_env)
if (DEFINED ENV{PATH} AND NOT "$ENV{PATH}" STREQUAL "")
  if (NOT WIN32)
    list(APPEND webrtc_build_env PATH=$ENV{PATH})
  endif()
endif()
if (DEFINED ENV{DEVELOPER_DIR} AND NOT "$ENV{DEVELOPER_DIR}" STREQUAL "")
  list(APPEND webrtc_build_env DEVELOPER_DIR=$ENV{DEVELOPER_DIR})
endif()
if (DEFINED ENV{SDKROOT} AND NOT "$ENV{SDKROOT}" STREQUAL "")
  list(APPEND webrtc_build_env SDKROOT=$ENV{SDKROOT})
endif()
if (DEFINED ENV{FORCE_MAC_SDK_MIN} AND NOT "$ENV{FORCE_MAC_SDK_MIN}" STREQUAL "")
  list(APPEND webrtc_build_env FORCE_MAC_SDK_MIN=$ENV{FORCE_MAC_SDK_MIN})
endif()

if(WIN32)
  set(suffix bat)
  set(PLATFORM windows)
else()
  set(suffix sh)
  if(APPLE)
    set(PLATFORM darwin)
  else()
    set(PLATFORM linux)
  endif()
endif()

if (WIN32)
  set(byproducts
    ${libwebrtc_binary_dir}/obj/webrtc.lib
  )
else()
  set(byproducts
    ${libwebrtc_binary_dir}/obj/libwebrtc.a
  )
endif()

ExternalProject_Add(
  project_libwebrtc

  PREFIX            ${CMAKE_BINARY_DIR}/external/libwebrtc/prefix
  TMP_DIR           ${CMAKE_BINARY_DIR}/external/libwebrtc/tmp
  STAMP_DIR         ${CMAKE_BINARY_DIR}/external/libwebrtc/stamp
  DOWNLOAD_DIR      ${CMAKE_BINARY_DIR}/external/libwebrtc/download
  SOURCE_DIR        ${CMAKE_BINARY_DIR}/external/libwebrtc/download/src
  BINARY_DIR        ${CMAKE_BINARY_DIR}/external/libwebrtc/build/${CMAKE_BUILD_TYPE}

  BUILD_BYPRODUCTS  ${byproducts}

  DOWNLOAD_COMMAND  ${CMAKE_COMMAND} -E env ${webrtc_build_env} DEPOT_TOOLS=${depot_tools_install_dir} PLATFORM=${PLATFORM} WEBRTC_REVISION=${WEBRTC_REVISION} ${CMAKE_SOURCE_DIR}/scripts/download-webrtc.${suffix}
  CONFIGURE_COMMAND ${CMAKE_COMMAND} -E env ${webrtc_build_env} BINARY_DIR=<BINARY_DIR> DEPOT_TOOLS=${depot_tools_install_dir} GN_GEN_ARGS=${GN_GEN_ARGS} SOURCE_DIR=<SOURCE_DIR> ${CMAKE_SOURCE_DIR}/scripts/configure-webrtc.${suffix}
  BUILD_COMMAND     ${CMAKE_COMMAND} -E env ${webrtc_build_env} CMAKE_BUILD_TYPE=${CMAKE_BUILD_TYPE} DEPOT_TOOLS=${depot_tools_install_dir} ${CMAKE_SOURCE_DIR}/scripts/build-webrtc.${suffix}
  INSTALL_COMMAND   ""
  PATCH_COMMAND ${CMAKE_COMMAND} -E env bash ${CMAKE_SOURCE_DIR}/scripts/patch-webrtc-base64.sh <SOURCE_DIR>
)

add_dependencies(project_libwebrtc project_depot_tools)

ExternalProject_Get_Property(project_libwebrtc DOWNLOAD_DIR)
set(libwebrtc_source_dir "${DOWNLOAD_DIR}")

ExternalProject_Get_Property(project_libwebrtc BINARY_DIR)
set(libwebrtc_binary_dir "${BINARY_DIR}")

add_library(libwebrtc STATIC IMPORTED)
add_dependencies(libwebrtc project_libwebrtc)

if(WIN32)
  set_property(TARGET libwebrtc PROPERTY IMPORTED_LOCATION "${libwebrtc_binary_dir}/obj/webrtc.lib")
else()
  set_property(TARGET libwebrtc PROPERTY IMPORTED_LOCATION "${libwebrtc_binary_dir}/obj/libwebrtc.a")
endif()

# NOTE(mroberts): I would like this to be INTERFACE.
#
#   https://gitlab.kitware.com/cmake/cmake/issues/15052
#
# target_include_directories(libwebrtc SYSTEM INTERFACE
#   ${libwebrtc_source_dir}
#   ${libwebrtc_source_dir}/webrtc
#   ${libwebrtc_source_dir}/webrtc/third_party/abseil-cpp
#   ${libwebrtc_source_dir}/webrtc/third_party/libyuv/include
# )

# catch2
# -----------------------------------------------------------------------------

ExternalProject_Add(
  project_catch2

  GIT_REPOSITORY    https://github.com/catchorg/Catch2.git
  GIT_TAG           a1cdff4f188170c5b0aa3d5d217b60d821f237df

  PREFIX            ${CMAKE_BINARY_DIR}/external/catch2/prefix
  TMP_DIR           ${CMAKE_BINARY_DIR}/external/catch2/tmp
  STAMP_DIR         ${CMAKE_BINARY_DIR}/external/catch2/stamp
  DOWNLOAD_DIR      ${CMAKE_BINARY_DIR}/external/catch2/download
  SOURCE_DIR        ${CMAKE_BINARY_DIR}/external/catch2/src
  BINARY_DIR        ${CMAKE_BINARY_DIR}/external/catch2/build

  CONFIGURE_COMMAND ""
  BUILD_COMMAND     ""
  INSTALL_COMMAND   ""
)

ExternalProject_Get_Property(project_catch2 SOURCE_DIR)
set(catch2_install_dir ${SOURCE_DIR})

# node-webrtc
# -----------------------------------------------------------------------------

set(MODULE wrtc)
include(${CMAKE_SOURCE_DIR}/NodeJS.cmake)
if(DEFINED ENV{npm_config_runtime})
  if($ENV{npm_config_runtime} STREQUAL "electron")
    if(NOT DEFINED ENV{npm_config_target})
      message(FATAL_ERROR "npm_config_target must be defined for electron build")
    endif()
    list(APPEND nodejs_init_args "VERSION" v$ENV{npm_config_target})
    if(NOT DEFINED ENV{npm_config_disturl})
      message(FATAL_ERROR "npm_config_disturl must be defined for electron build")
    endif()
    list(APPEND nodejs_init_args "URL" $ENV{npm_config_disturl})
    if($ENV{npm_config_target} STRLESS "4")
      list(APPEND nodejs_init_args "NAME" "iojs")
    endif()
  endif()
endif()
nodejs_init(${nodejs_init_args})

file(GLOB_RECURSE MODULE_SRC src/*.cc src/*.h)
add_nodejs_module(${MODULE} ${MODULE_SRC})
set_property(TARGET ${MODULE} PROPERTY CXX_STANDARD 20)

if(MSVC)
  target_compile_options(${MODULE} PRIVATE "/FI${CMAKE_SOURCE_DIR}/src/webrtc/compat.h")
else()
  target_compile_options(${MODULE} PRIVATE "-include${CMAKE_SOURCE_DIR}/src/webrtc/compat.h")
endif()

if(NOT iwyu_path STREQUAL "iwyu_path-NOTFOUND")
  set_property(TARGET ${MODULE} PROPERTY CXX_INCLUDE_WHAT_YOU_USE ${iwyu_path} -Xiwyu --mapping_file=${CMAKE_SOURCE_DIR}/.iwyu.imp)
endif()

if(NOT clang_tidy_path STREQUAL "clang_tidy_path-NOTFOUND")
  set_property(TARGET ${MODULE} PROPERTY CXX_CLANG_TIDY ${clang_tidy_path})
endif()

set(node_addon_api_dir ${CMAKE_SOURCE_DIR}/node_modules/node-addon-api)

# NOTE(mroberts): Workaround for
#
#   https://gitlab.kitware.com/cmake/cmake/issues/15052
#
# is to include all the header files here.
target_include_directories(${MODULE} SYSTEM PRIVATE
  ${node_addon_api_dir}/..
  ${libwebrtc_source_dir}
  ${libwebrtc_source_dir}/webrtc
  ${libwebrtc_source_dir}/webrtc/third_party/abseil-cpp
  ${libwebrtc_source_dir}/webrtc/third_party/libyuv/include
)

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
  add_dependencies(${MODULE} project_catch2)
  target_include_directories(${MODULE} SYSTEM PRIVATE
    ${catch2_install_dir}/single_include
  )
endif()

target_include_directories(${MODULE} PRIVATE
  ${CMAKE_SOURCE_DIR}
)

target_link_libraries(${MODULE} PRIVATE
  ${CMAKE_THREAD_LIBS_INIT}
  libwebrtc
)

target_compile_definitions(${MODULE} PRIVATE
  -DNAPI_VERSION=3
  -DUSE_BUILTIN_SW_CODECS
)

if(WIN32)
  set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /MT /GR-")
  set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} /MTd /GR- -D_HAS_ITERATOR_DEBUGGING=0")
  set(CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS} /FORCE:UNRESOLVED")

  target_link_libraries(${MODULE} PRIVATE
    dmoguids.lib
    msdmo.lib
    secur32.lib
    winmm.lib
    wmcodecdspuuid.lib
    ws2_32.lib
  )

  target_compile_definitions(${MODULE} PRIVATE
    -D_WINSOCKAPI_
    -DINCL_EXTRA_HTON_FUNCTIONS
    -DNOGDI
    -DNOMINMAX
    -DWEBRTC_WIN
  )
elseif(APPLE)
  target_link_libraries(${MODULE} PRIVATE
    -lm
  )

  target_compile_options(${MODULE} PRIVATE
    -fno-rtti
    -fvisibility=hidden
    -Wall
    -Wextra
    -Wno-missing-field-initializers
    -Wno-uninitialized
    -Wno-unused-local-typedefs
    -Wno-unused-variable
    -Wno-suggest-override
    -Wpedantic
    -Wno-missing-prototypes
  )

  target_compile_definitions(${MODULE} PRIVATE
    -DWEBRTC_POSIX=1
  )

  if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    target_compile_options(${MODULE} PRIVATE
      -g
    )

    target_compile_definitions(${MODULE} PRIVATE
      -DDEBUG
    )
  endif()

  target_link_libraries(${MODULE} PRIVATE
    "-framework AppKit"
    "-framework AVFoundation"
  )

  if ("$ENV{TARGET_ARCH}" STREQUAL "arm64")
    target_compile_options(${MODULE} PRIVATE
      -arch arm64
    )
    target_link_options(${MODULE} PRIVATE
      -arch arm64
    )
  endif()

  target_compile_options(${MODULE} PRIVATE
    -Weverything
    -Wno-c++98-compat
    -Wno-c++98-compat-pedantic
    -Wno-documentation
    -Wno-exit-time-destructors
    -Wno-float-conversion
    -Wno-global-constructors
    -Wno-padded
    -Wno-shadow
    -Wno-shadow-field-in-constructor
    -Wno-shorten-64-to-32
    -Wno-sign-conversion
    -Wno-thread-safety-negative
    -Wno-unused-template
    -Wno-weak-vtables
  )

  target_compile_definitions(${MODULE} PRIVATE
    -DWEBRTC_MAC
  )
else()
  # Linux: use system libstdc++ to avoid linking against Clang-specific bundled
  # libc++ headers that are incompatible with GCC (e.g. anonymous struct with
  # base classes in libc++/include/string).  libwebrtc is also built with
  # use_custom_libcxx=false on Linux, so both sides share the same ABI.
  target_link_libraries(${MODULE} PRIVATE
    -lm
  )

  target_compile_options(${MODULE} PRIVATE
    -fno-rtti
    -fvisibility=hidden
    -Wall
    -Wextra
    -Wno-missing-field-initializers
    -Wno-uninitialized
    -Wno-unused-local-typedefs
    -Wno-unused-variable
    -Wno-suggest-override
    -Wpedantic
    -fpermissive
  )

  target_compile_definitions(${MODULE} PRIVATE
    -DWEBRTC_POSIX=1
    -DWEBRTC_LINUX
  )

  if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    target_compile_options(${MODULE} PRIVATE
      -g
    )

    target_compile_definitions(${MODULE} PRIVATE
      -DDEBUG
    )
  endif()

  if ("$ENV{TARGET_ARCH}" STREQUAL "arm" OR "$ENV{TARGET_ARCH}" STREQUAL "arm64")
    set(CMAKE_SYSTEM_NAME Linux)
    set(CMAKE_SYSTEM_PROCESSOR "$ENV{TARGET_ARCH}")
    set(tools $ENV{ARM_TOOLS_PATH})

    set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
    set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
    set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
    set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)

    if ("$ENV{TARGET_ARCH}" STREQUAL "arm")
      set(CMAKE_SYSROOT ${libwebrtc_source_dir}/src/build/linux/debian_sid_arm-sysroot)
      target_compile_options(${MODULE} PRIVATE
        -march=armv7-a
        -mfloat-abi=hard
        -mtune=generic-armv7-a
        -mfpu=neon
      )
      set(CMAKE_C_COMPILER ${tools}/bin/arm-linux-gnueabihf-gcc)
      set(CMAKE_CXX_COMPILER ${tools}/bin/arm-linux-gnueabihf-g++)
    else()
      set(CMAKE_SYSROOT ${libwebrtc_source_dir}/src/build/linux/debian_sid_arm64-sysroot)
      set(CMAKE_C_COMPILER ${tools}/bin/aarch64-linux-gnu-gcc)
      set(CMAKE_CXX_COMPILER ${tools}/bin/aarch64-linux-gnu-g++)
    endif()
  else()
    target_compile_options(${MODULE} PRIVATE
      -B${libwebrtc_source_dir}/src/third_party/binutils/Linux_x64/Release/bin
    )
  endif()
endif()

# astyle
# -----------------------------------------------------------------------------

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
  list(APPEND ASTYLE_CMAKE_ARGS "-DCMAKE_INSTALL_PREFIX=${CMAKE_BINARY_DIR}")

  ExternalProject_Add(
    astyle
    GIT_REPOSITORY      https://github.com/Bareflank/astyle.git
    GIT_TAG             v1.2
    GIT_SHALLOW         true
    CMAKE_ARGS          ${ASTYLE_CMAKE_ARGS}
    PREFIX              ${CMAKE_BINARY_DIR}/external/astyle/prefix
    TMP_DIR             ${CMAKE_BINARY_DIR}/external/astyle/tmp
    STAMP_DIR           ${CMAKE_BINARY_DIR}/external/astyle/stamp
    DOWNLOAD_DIR        ${CMAKE_BINARY_DIR}/external/astyle/download
    SOURCE_DIR          ${CMAKE_BINARY_DIR}/external/astyle/src
    BINARY_DIR          ${CMAKE_BINARY_DIR}/external/astyle/build
  )

  list(APPEND ASTYLE_ARGS
    --style=google
    --lineend=linux
    --suffix=none
    --pad-oper
    --unpad-paren
    --align-pointer=type
    --align-reference=type
    --indent-preproc-define
    --indent-switches
    --indent-col1-comments
    --keep-one-line-statements
    --keep-one-line-blocks
    --pad-header
    --convert-tabs
    --min-conditional-indent=0
    --indent=spaces=2
    --indent-continuation=2
    --indent-after-parens
    --close-templates
    --add-brackets
    --break-after-logical
    ${MODULE_SRC}
  )

  if(NOT WIN32 STREQUAL "1")
    add_custom_target(
      format
      COMMAND ${CMAKE_BINARY_DIR}/bin/astyle ${ASTYLE_ARGS}
      COMMENT "running astyle"
    )
  else()
    add_custom_target(
      format
      COMMAND ${CMAKE_BINARY_DIR}/bin/astyle.exe ${ASTYLE_ARGS}
      COMMENT "running astyle"
    )
  endif()
endif()
