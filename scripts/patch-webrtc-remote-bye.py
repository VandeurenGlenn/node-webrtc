#!/usr/bin/env python3
"""Restore M154 stop/BYE transmission and matching receiver notifications."""

from pathlib import Path
import sys
import runpy


def replacements():
    edits = {
        "pc/peer_connection.cc": [(
            "  // Don't destroy BaseChannels until after stats has been cleaned up so that\n",
            "  // node-webrtc: flush media stop/BYE while SRTP transports are attached.\n"
            "  worker_tasks.Run();\n\n"
            "  // Don't destroy BaseChannels until after stats has been cleaned up so that\n",
        )],
        "api/rtp_receiver_interface.h": [(
            " protected:\n  virtual ~RtpReceiverObserverInterface() {}",
            "  // node-webrtc: called on the signaling thread for a matching RTCP BYE.\n"
            "  virtual void OnByeReceived(MediaType media_type) {}\n\n"
            " protected:\n  virtual ~RtpReceiverObserverInterface() {}",
        )],
        "pc/rtp_receiver.h": [(
            "  virtual int AttachmentId() const = 0;\n",
            "  virtual int AttachmentId() const = 0;\n"
            "  virtual void NotifyByeReceived() {}\n",
        )],
        "pc/rtp_transport_internal.h": [(
            "  // There doesn't seem to be a need to unsubscribe from this signal.\n",
            "  void UnsubscribeRtcpPacketReceived(const void* tag) {\n"
            "    callback_list_rtcp_packet_received_.RemoveReceivers(tag);\n  }\n",
        )],
        "pc/rtp_transceiver.cc": [
            (
                "  std::vector<absl::AnyInvocable<void() &&>> stop_sender_actions =\n"
                "      DetachAndGetStopTasksForSenders(senders_);\n",
                "  std::vector<uint32_t> sending_ssrcs;\n"
                "  for (const auto& sender : senders_) {\n"
                "    if (sender->ssrc()) sending_ssrcs.push_back(sender->ssrc());\n"
                "  }\n"
                "  auto* channel = channel_.get();\n"
                "  std::vector<absl::AnyInvocable<void() &&>> stop_sender_actions =\n"
                "      DetachAndGetStopTasksForSenders(senders_);\n",
            ),
            (
                "      [this, stop_sender_actions = std::move(stop_sender_actions)]() mutable {\n"
                "        RTC_DCHECK_RUN_ON(context()->worker_thread());\n"
                "        for (auto& task : stop_sender_actions) {\n"
                "          std::move(task)();\n"
                "        }\n"
                "        ClearMediaChannelReferences();\n"
                "      };",
                "      [this, channel, sending_ssrcs = std::move(sending_ssrcs),\n"
                "       stop_sender_actions = std::move(stop_sender_actions)]() mutable {\n"
                "        RTC_DCHECK_RUN_ON(context()->worker_thread());\n"
                "        for (auto& task : stop_sender_actions) {\n"
                "          std::move(task)();\n"
                "        }\n"
                "        const auto streams = channel ? channel->local_streams() : std::vector<StreamParams>();\n"
                "        auto* send_channel = channel ? channel->media_send_channel() : nullptr;\n"
                "        if (send_channel) {\n"
                "          for (uint32_t ssrc : sending_ssrcs) send_channel->RemoveSendStream(ssrc);\n"
                "        }\n"
                "        if (!streams.empty()) context()->network_thread()->BlockingCall([this, &streams] {\n"
                "          if (!rtp_transport_ || !rtp_transport_->IsWritable(true) ||\n"
                "              !rtp_transport_->IsSrtpActive()) return;\n"
                "          // M154 RTCPSender::SetSendingStatus no longer sends BYE.\n"
                "          // Send authenticated compound RR/SDES/BYE for every source,\n"
                "          // including simulcast and repair SSRCs, before transport teardown.\n"
                "          for (const auto& stream : streams) for (uint32_t ssrc : stream.ssrcs) {\n"
                "            rtcp::CompoundPacket compound;\n"
                "            auto report = std::make_unique<rtcp::ReceiverReport>();\n"
                "            report->SetSenderSsrc(ssrc);\n"
                "            compound.Append(std::move(report));\n"
                "            auto sdes = std::make_unique<rtcp::Sdes>();\n"
                "            if (!sdes->AddCName(ssrc, stream.cname)) continue;\n"
                "            compound.Append(std::move(sdes));\n"
                "            auto bye = std::make_unique<rtcp::Bye>();\n"
                "            bye->SetSenderSsrc(ssrc);\n"
                "            compound.Append(std::move(bye));\n"
                "            auto buffer = compound.Build();\n"
                "            // SRTCP appends a 32-bit index and up to 16 bytes of authentication.\n"
                "            CopyOnWriteBuffer packet(buffer.data(), buffer.size(),\n"
                "                                   buffer.size() + sizeof(uint32_t) + 16);\n"
                "            rtp_transport_->SendRtcpPacket(&packet, AsyncSocketPacketOptions(), PF_SRTP_BYPASS);\n"
                "          }\n"
                "        });\n"
                "        ClearMediaChannelReferences();\n"
                "      };",
            ),
            (
                '#include "pc/rtp_transceiver.h"\n',
                '#include "pc/rtp_transceiver.h"\n\n#include <algorithm>\n'
                '#include "modules/rtp_rtcp/source/rtcp_packet/bye.h"\n'
                '#include "modules/rtp_rtcp/source/rtcp_packet/common_header.h"\n'
                '#include "modules/rtp_rtcp/source/rtcp_packet/compound_packet.h"\n'
                '#include "modules/rtp_rtcp/source/rtcp_packet/receiver_report.h"\n'
                '#include "modules/rtp_rtcp/source/rtcp_packet/sdes.h"\n',
            ),
            (
                "    rtp_transport_->UnsubscribeNetworkRouteChanged(this);\n",
                "    rtp_transport_->UnsubscribeNetworkRouteChanged(this);\n"
                "    rtp_transport_->UnsubscribeRtcpPacketReceived(this);\n",
            ),
            (
                "    rtp_transport_->SubscribeNetworkRouteChanged(\n",
                "    // node-webrtc: this callback sees authenticated, decrypted RTCP.\n"
                "    rtp_transport_->SubscribeRtcpPacketReceived(\n"
                "        this, [this, flag = signaling_thread_safety_](\n"
                "                  CopyOnWriteBuffer packet, std::optional<Timestamp>, EcnMarking) {\n"
                "          if (packet.size() < 4) return;\n"
                "          std::vector<uint32_t> sources;\n"
                "          const uint8_t* position = packet.cdata();\n"
                "          const uint8_t* end = position + packet.size();\n"
                "          while (position < end) {\n"
                "            rtcp::CommonHeader header;\n"
                "            if (!header.Parse(position, end - position)) return;\n"
                "            if (header.type() == rtcp::Bye::kPacketType) {\n"
                "              rtcp::Bye bye;\n"
                "              if (!bye.Parse(header)) return;\n"
                "              sources.push_back(bye.sender_ssrc());\n"
                "              sources.insert(sources.end(), bye.csrcs().begin(), bye.csrcs().end());\n"
                "            }\n"
                "            position = header.NextPacket();\n"
                "          }\n"
                "          if (sources.empty()) return;\n"
                "          // Permit the very next RTP packet to unmute again. On BUNDLE,\n"
                "          // unrelated receivers only get a harmless duplicate packet notice.\n"
                "          packet_notified_after_receptive_ = false;\n"
                "          thread_->PostTask(SafeTask(flag, [this, sources = std::move(sources)] {\n"
                "            if (stopping() || stopped() || !receptive_) return;\n"
                "            bool channel_match = false;\n"
                "            if (unified_plan_ && channel_) {\n"
                "              channel_match = context()->worker_thread()->BlockingCall([&] {\n"
                "                for (const auto& stream : channel_->remote_streams()) {\n"
                "                  for (uint32_t ssrc : stream.ssrcs) {\n"
                "                    if (std::find(sources.begin(), sources.end(), ssrc) != sources.end()) return true;\n"
                "                  }\n"
                "                }\n"
                "                return false;\n"
                "              });\n"
                "            }\n"
                "            for (const auto& receiver : receivers_) {\n"
                "              const auto parameters = receiver->GetParameters();\n"
                "              bool matches = channel_match;\n"
                "              for (const auto& encoding : parameters.encodings) {\n"
                "                if (encoding.ssrc && std::find(sources.begin(), sources.end(),\n"
                "                                               *encoding.ssrc) != sources.end()) {\n"
                "                  matches = true;\n"
                "                }\n"
                "              }\n"
                "              if (matches) receiver->internal()->NotifyByeReceived();\n"
                "            }\n"
                "          }));\n"
                "        });\n"
                "    rtp_transport_->SubscribeNetworkRouteChanged(\n",
            ),
        ],
    }
    for kind in ("audio", "video"):
        name = kind.title() + "RtpReceiver"
        edits[f"pc/{kind}_rtp_receiver.h"] = [(
            "  void NotifyFirstPacketReceivedAfterReceptiveChange(uint32_t ssrc) override;\n",
            "  void NotifyFirstPacketReceivedAfterReceptiveChange(uint32_t ssrc) override;\n"
            "  void NotifyByeReceived() override;\n",
        )]
        edits[f"pc/{kind}_rtp_receiver.cc"] = [(
            f"std::vector<RtpSource> {name}::GetSources() const {{",
            f"void {name}::NotifyByeReceived() {{\n"
            "  RTC_DCHECK_RUN_ON(&signaling_thread_checker_);\n"
            "  if (observer_) observer_->OnByeReceived(media_type());\n}\n\n"
            f"std::vector<RtpSource> {name}::GetSources() const {{",
        )]
    return edits


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(f"usage: {Path(sys.argv[0]).name} WEBRTC_SOURCE_DIR")
    # Use the same fail-closed, idempotent anchor validation as the stats patch.
    patcher = runpy.run_path(str(Path(__file__).with_name("patch-webrtc-stopped-stats.py")))
    patcher["patch"](Path(sys.argv[1]), replacements())
