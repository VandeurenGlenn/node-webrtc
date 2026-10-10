#!/usr/bin/env python3
"""Fix M154 stats snapshots when a transceiver enters the stopping state."""

from pathlib import Path
import sys


def replacements():
    return {
        "pc/peer_connection.cc": [(
            "        sdp_handler_->UpdateNegotiationNeeded();\n",
            "        // node-webrtc: RTP changes invalidate stats, including stop().\n"
            "        ClearStatsCache();\n"
            "        sdp_handler_->UpdateNegotiationNeeded();\n",
        )],
        "pc/rtc_stats_collector.cc": [
            (
                "  int64_t partial_report_timestamp_us = 0;\n",
                "  int64_t partial_report_timestamp_us = 0;\n"
                "  // node-webrtc: retain pre-change requests without caching stale stats.\n"
                "  bool cache_invalidated = false;\n"
                "  std::vector<RequestInfo> deferred_requests;\n",
            ),
            (
                '  // "Now" using a monotonically increasing timer.\n  int64_t cache_now_us',
                "  if (collection_context_ && collection_context_->cache_invalidated) {\n"
                "    collection_context_->deferred_requests.push_back(std::move(request));\n"
                "    return;\n  }\n\n"
                '  // "Now" using a monotonically increasing timer.\n  int64_t cache_now_us',
            ),
            (
                "  cached_report_ = nullptr;\n",
                "  cached_report_ = nullptr;\n"
                "  if (collection_context_) {\n"
                "    collection_context_->cache_invalidated = true;\n  }\n",
            ),
            (
                "  cached_report_ = std::move(collection_context_->partial_report);\n"
                "  collection_context_ = nullptr;\n",
                "  auto report = std::move(collection_context_->partial_report);\n"
                "  auto deferred_requests = std::move(collection_context_->deferred_requests);\n"
                "  if (!collection_context_->cache_invalidated) {\n"
                "    cached_report_ = report;\n  }\n"
                "  collection_context_ = nullptr;\n",
            ),
            ('"report", cached_report_->ToJson());', '"report", report->ToJson());'),
            (
                "    DeliverReport(request, cached_report_);\n  }\n",
                "    DeliverReport(request, report);\n  }\n"
                "  for (auto& request : deferred_requests) {\n"
                "    GetStatsReportInternal(std::move(request));\n  }\n",
            ),
            (
                "        .current_direction = transceiver->current_direction(),\n",
                "        // A stopped m-section need not have been renegotiated yet.\n"
                "        .current_direction = transceiver->stopping()\n"
                "                                 ? RtpTransceiverDirection::kStopped\n"
                "                                 : transceiver->current_direction(),\n",
            ),
        ],
    }


def patch(source_root, edits=None):
    pending = []
    # Validate every anchor before modifying any file; unknown revisions fail closed.
    for filename, file_edits in (replacements() if edits is None else edits).items():
        path = source_root / filename
        original = content = path.read_text()
        for before, after in file_edits:
            if content.count(after) == 1:
                continue
            if content.count(before) != 1:
                raise SystemExit(f"expected unique stats patch anchor in {path}: {before!r}")
            content = content.replace(before, after, 1)
        pending.append((path, original, content))
    for path, original, content in pending:
        if content != original:
            path.write_text(content)
            print(f"Patched WebRTC compatibility in {path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(f"usage: {Path(sys.argv[0]).name} WEBRTC_SOURCE_DIR")
    patch(Path(sys.argv[1]))
