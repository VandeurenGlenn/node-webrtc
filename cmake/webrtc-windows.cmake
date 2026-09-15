# Keep the MSVC STL ABI while producing LLVM objects for clang-cl/lld-link.
list(APPEND GN_GEN_ARGS
  use_thin_lto=false
  use_custom_libcxx=false
  use_custom_libcxx_for_host=false
  treat_warnings_as_errors=false
  fatal_linker_warnings=false
)
