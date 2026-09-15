#include "src/dictionaries/webrtc/rtc_stats_member_interface.h"

#include <cstdint>
#include <iosfwd>
#include <map>
#include <string>
#include <utility>
#include <variant>
#include <vector>

#include <node-addon-api/napi.h>
#include <webrtc/api/stats/rtc_stats.h>

#include "src/converters.h"

namespace node_webrtc {

template <typename T>
static Validation<Napi::Value> ConvertAttributeValue(Napi::Env env, const T& value) {
  return From<Napi::Value>(std::make_pair(env, value));
}

template <typename T>
static Validation<Napi::Value> ConvertAttributeValue(Napi::Env env, const std::map<std::string, T>& value) {
  Napi::EscapableHandleScope scope(env);
  auto object = Napi::Object::New(env);
  for (const auto& [key, item] : value) {
    auto converted = From<Napi::Value>(std::make_pair(env, item));
    if (converted.IsInvalid()) {
      return Validation<Napi::Value>::Invalid(converted.ToErrors());
    }
    object.Set(key, converted.UnsafeFromValid());
    if (env.IsExceptionPending()) {
      return Validation<Napi::Value>::Invalid(env.GetAndClearPendingException().Message());
    }
  }
  return Pure(scope.Escape(object));
}

TO_NAPI_IMPL(const webrtc::Attribute*, pair) {
  auto env = pair.first;
  auto value = pair.second;
  if (!value || !value->has_value()) {
    return Pure(env.Undefined());
  }
  return std::visit([env](const auto* optional) {
    return ConvertAttributeValue(env, optional->value());
  }, value->as_variant());
}

} // namespace node_webrtc
