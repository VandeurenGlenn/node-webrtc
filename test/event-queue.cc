#include <cassert>
#include <thread>
#include <vector>

#include "src/node/event_queue.h"

int main() {
  node_webrtc::EventQueue<std::vector<int>> queue;
  std::vector<int> received;
  constexpr int count = 10000;
  std::thread producer([&] {
    for (int i = 0; i < count; ++i) {
      queue.Enqueue(node_webrtc::Callback1<std::vector<int>>::Create(
          [i](std::vector<int>& values) { values.push_back(i); }));
    }
  });
  while (received.size() < count) {
    auto batch = queue.TakeAll();
    while (!batch.empty()) {
      batch.front()->Dispatch(received);
      batch.pop();
    }
    std::this_thread::yield();
  }
  producer.join();
  assert(queue.IsEmpty());
  for (int i = 0; i < count; ++i) {
    assert(received[i] == i);
  }

  // Enqueue during dispatch must not deadlock or alter the detached batch.
  queue.Enqueue(node_webrtc::Callback1<std::vector<int>>::Create(
      [&](std::vector<int>&) { queue.Enqueue(node_webrtc::Event<std::vector<int>>::Create()); }));
  auto batch = queue.TakeAll();
  batch.front()->Dispatch(received);
  assert(batch.size() == 1);
  assert(!queue.IsEmpty());
  assert(queue.TakeAll().size() == 1);
  assert(queue.IsEmpty());
}
