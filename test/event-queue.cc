#include <cassert>
#include <thread>
#include <vector>

#include "src/node/event_queue.h"

int main() {
  node_webrtc::EventQueue<std::vector<int>> queue;
  std::vector<int> received;
  constexpr int count = 10000;
  node_webrtc::EventQueue<std::vector<int>>::Batch batch;
  std::thread producer([&] {
    for (int i = 0; i < count; ++i) {
      queue.Enqueue(node_webrtc::Callback1<std::vector<int>>::Create(
          [i](std::vector<int>& values) { values.push_back(i); }));
    }
  });
  while (received.size() < count) {
    queue.TakeAll(batch);
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
  queue.TakeAll(batch);
  batch.front()->Dispatch(received);
  assert(batch.size() == 1);
  assert(!queue.IsEmpty());
  assert(queue.TakeAll().size() == 1);
  assert(queue.IsEmpty());
  batch.pop();
  // Empty drains and repeated producer/consumer storage swaps are valid.
  for (int i = 0; i < 1000; ++i) {
    queue.TakeAll(batch);
    assert(batch.empty());
    queue.Enqueue(node_webrtc::Event<std::vector<int>>::Create());
    queue.TakeAll(batch);
    assert(batch.size() == 1);
    assert(queue.IsEmpty());
    batch.pop();
  }
}
