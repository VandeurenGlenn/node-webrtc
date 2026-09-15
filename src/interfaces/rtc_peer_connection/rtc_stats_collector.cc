/* Copyright (c) 2019 The node-webrtc project authors. All rights reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be found
 * in the LICENSE.md file in the root of the source tree. All contributing
 * project authors may be found in the AUTHORS file in the root of the source
 * tree.
 */
#include "src/interfaces/rtc_peer_connection/rtc_stats_collector.h"

#include <algorithm>
#include <map>
#include <string>
#include <utility>
#include <vector>

#include <webrtc/api/stats/rtc_stats_report.h>

#include "src/dictionaries/node_webrtc/rtc_stats_response_init.h"  // IWYU pragma: keep
#include "src/dictionaries/webrtc/rtc_stats_report.h"  // IWYU pragma: keep

void node_webrtc::RTCStatsCollector::OnStatsDelivered(const rtc::scoped_refptr<const webrtc::RTCStatsReport>& report) {
  Resolve(report->Copy());
}

void node_webrtc::LegacyRTCStatsCollector::OnStatsDelivered(
    const rtc::scoped_refptr<const webrtc::RTCStatsReport>& report) {
  double timestamp = 0;
  std::vector<std::map<std::string, std::string>> reports;
  reports.reserve(report->size());

  for (const webrtc::RTCStats& stats : *report) {
    std::map<std::string, std::string> legacy_report;
    timestamp = std::max(timestamp, stats.timestamp().us<double>() / 1000.0);
    legacy_report.emplace("id", stats.id());
    legacy_report.emplace("type", stats.type());
    for (const auto& attribute : stats.Attributes()) {
      if (attribute.has_value()) {
        legacy_report.emplace(attribute.name(), attribute.ToString());
      }
    }
    reports.push_back(std::move(legacy_report));
  }

  Resolve(RTCStatsResponseInit(timestamp, std::move(reports)));
}
